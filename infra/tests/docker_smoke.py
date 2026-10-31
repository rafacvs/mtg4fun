#!/usr/bin/env python3
"""Verify dev/prod contracts using isolated projects, ports, volumes and sources."""
import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def verify_live(port, room_id, cookies, url):
    """The room WebSocket must cross the proxy with the session, and refuse other origins."""
    cookie = "; ".join(f"{item.name}={item.value}" for item in cookies)

    def handshake(origin):
        with socket.create_connection(("127.0.0.1", port), timeout=10) as connection:
            connection.sendall((f"GET /api/rooms/{room_id}/live HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n"
                                f"Upgrade: websocket\r\nConnection: Upgrade\r\nOrigin: {origin}\r\nCookie: {cookie}\r\n"
                                "Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n").encode())
            received = b""
            # The first frame after the upgrade is the state of the dice game.
            while b'"game":"dice"' not in received and len(received) < 8192:
                chunk = connection.recv(4096)
                if not chunk:
                    break
                received += chunk
                if not received.startswith(b"HTTP/1.1 101"):
                    break
            return received

    allowed = handshake(url)
    if not allowed.startswith(b"HTTP/1.1 101") or b'"game":"dice"' not in allowed:
        raise AssertionError(f"WebSocket não atravessou o proxy: {allowed[:300]!r}")
    refused = handshake("https://outro.example")
    if not refused.startswith(b"HTTP/1.1 403"):
        raise AssertionError(f"WebSocket aceitou outra origem: {refused[:300]!r}")


def verify(mode):
    project = f"mtg4fun-{mode}-test-{secrets.token_hex(4)}"
    port = free_port()
    env = {**os.environ, "PORT": str(port), "MYSQL_PORT": str(free_port()),
           "BIND_ADDR": "127.0.0.1", "COOKIE_SECURE": "false", "DB_TLS": "false", "DB_TLS_CA": "",
           "DB_HOST": "mysql", "DB_PORT": "3306", "DB_NAME": "mtg4fun", "DB_USER": "mtg4fun",
           "DB_PASSWORD": secrets.token_hex(20), "MYSQL_ROOT_PASSWORD": secrets.token_hex(20),
           "DB_CONNECT_TIMEOUT": "300s"}
    url = f"http://127.0.0.1:{port}"
    cookies = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    with tempfile.TemporaryDirectory(prefix=f"mtg4fun-{mode}-") as staging:
        files = [str(ROOT / "infra/compose.yaml")]
        env_file = Path(staging) / ".env"
        command = ["docker", "compose", "--env-file", str(env_file), "-p", project]
        if mode == "dev":
            # Never mutate the developer's files to verify reload.
            sources = Path(staging)
            for folder in ("api", "app"):
                shutil.copytree(ROOT / folder, sources / folder,
                                ignore=shutil.ignore_patterns("node_modules", "dist", "bin", "data", "test-results", "playwright-report"))
            override = sources / "mounts.json"
            override.write_text(json.dumps({"services": {
                "api": {"volumes": [f"{sources / 'api'}:/src/api"]},
                "app": {"volumes": [f"{sources / 'app'}:/src/app"]},
            }}))
            files += [str(ROOT / "infra/compose.dev.yaml"), str(override)]
        # Use Compose's .env mode selection instead of CLI file/profile flags.
        env_file.write_text(f"COMPOSE_FILE={os.pathsep.join(files)}\nCOMPOSE_PROFILES=local-db\n")
        env.pop("COMPOSE_FILE", None)
        env.pop("COMPOSE_PROFILES", None)

        def compose(*args, check=True):
            result = subprocess.run([*command, *args], cwd=ROOT, env=env, text=True, capture_output=True)
            if check and result.returncode:
                raise RuntimeError(f"Docker Compose falhou: {result.stdout}\n{result.stderr}")
            return result.stdout

        def request(method="GET", path="/api/session", data=None):
            body = json.dumps(data).encode() if data is not None else None
            headers = {"Content-Type": "application/json", "Origin": url} if body else {"Origin": url}
            req = urllib.request.Request(url + path, data=body, headers=headers, method=method)
            try:
                response = client.open(req, timeout=5)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                return response.status, response.read()

        def ready():
            deadline = time.monotonic() + 900
            api_down_since = None
            while time.monotonic() < deadline:
                try:
                    home, session = request(path="/")[0], request()[0]
                    if home == 200 and session in (200, 401):
                        return
                    if home == 200 and session == 502:
                        if api_down_since is None:
                            api_down_since = time.monotonic()
                        elif time.monotonic() - api_down_since > 180:
                            raise RuntimeError("A API encerrou e o frontend ficou respondendo 502")
                    else:
                        api_down_since = None
                except (OSError, urllib.error.URLError):
                    api_down_since = None
                time.sleep(0.5)
            raise RuntimeError("Serviços Docker não ficaram prontos")

        def require(actual, status):
            if actual[0] != status:
                raise AssertionError(f"HTTP {actual[0]}, esperado {status}: {actual[1]!r}")

        def create(login, name, password, check=True):
            executable = "mtg4fun"
            return compose("exec", "-T", "api", executable, "create-user", "--login", login,
                           "--name", name, "--password", password, check=check)

        try:
            print(f"{mode}: construindo e iniciando projeto isolado {project}...", flush=True)
            if mode == "prod":
                compose("run", "--build", "--rm", "api", "migrate", "up")
            compose("up", "--build", "--detach", "api")
            running = set(compose("ps", "--services", "--status", "running").split())
            if running != {"api", "mysql"}:
                raise AssertionError(f"Subir api deve iniciar apenas api e mysql: {running}")
            compose("up", "--build", "--detach", "api", "app")
            ready()
            version = compose("exec", "-T", "mysql", "mysql", "--version")
            if "26.7.0" not in version:
                raise AssertionError(f"Versão incorreta: {version}")
            require(request(), 401)
            require(request(path="/preparacao"), 200)
            create("amigo", "Amigo da mesa", "senha-do-navegador")
            create("segundo", "Segundo amigo", "senha-do-navegador")
            create("convidado", "Convidado Docker", "senha-exclusiva-do-teste")
            executable = "mtg4fun"
            duplicate = subprocess.run([*command, "exec", "-T", "api", executable, "create-user", "--name", "convidado", "--password", "outra-senha"],
                                       cwd=ROOT, env=env, capture_output=True, text=True)
            if duplicate.returncode == 0 or "login já existe" not in duplicate.stderr:
                raise AssertionError("Conta duplicada não foi rejeitada")
            credentials = {"login": "convidado", "password": "senha-exclusiva-do-teste"}
            require(request("POST", data={**credentials, "password": "senha-incorreta"}), 401)
            require(request("POST", data=credentials), 200)
            first = request()
            require(first, 200)
            browser_env = {**env, "E2E_BASE_URL": url}
            subprocess.run(["npm", "test", "--prefix", "app", "--", "acesso.spec.ts", "--workers=3"],
                           cwd=ROOT, env=browser_env, check=True)
            subprocess.run(["npm", "test", "--prefix", "app", "--", "salas.spec.ts", "--workers=1"],
                           cwd=ROOT, env=browser_env, check=True)
            if mode == "dev":
                browser_env["E2E_HOT_RELOAD_ROOT"] = staging
                subprocess.run(["npm", "test", "--prefix", "app", "--", "hot-reload.spec.ts", "--project=desktop", "--workers=1"],
                               cwd=ROOT, env=browser_env, check=True)
            rooms_before = request(path="/api/rooms")
            require(rooms_before, 200)
            # Two room-creating browser flows run on each of the three viewports.
            created = json.loads(rooms_before[1])["rooms"]
            if len(created) != 6:
                raise AssertionError(f"As salas criadas no navegador não foram preservadas: {len(created)}")
            print(f"{mode}: recriando todos os serviços e reutilizando o volume...", flush=True)
            compose("down")
            compose("up", "--detach", "api", "app")
            ready()
            after_restart = request()
            require(after_restart, 200)
            if after_restart[1] != first[1]:
                raise AssertionError("Sessão/identidade não sobreviveu à recriação")
            rooms_after = request(path="/api/rooms")
            require(rooms_after, 200)
            if rooms_after[1] != rooms_before[1]:
                raise AssertionError("Salas/participação não sobreviveram à recriação API/MySQL")
            require(request("DELETE"), 204)
            require(request(), 401)
            require(request("POST", data=credentials), 200)
            created_room = request("POST", "/api/rooms", {"name": "Mesa ao vivo", "format": "Commander", "seats": 2, "life": 40})
            require(created_room, 201)
            verify_live(port, json.loads(created_room[1])["room"]["id"], cookies, url)
            print(f"{mode}: navegador, API, conta, sessão, recriação, logout e WebSocket verificados.", flush=True)
        except BaseException:
            print(compose("logs", "--no-color", "--tail=60", check=False), flush=True)
            raise
        finally:
            compose("down", "--volumes", "--rmi", "local")
            subprocess.run(["docker", "run", "--rm", "-v", f"{staging}:/work", "golang:1.26-bookworm", "chmod", "-R", "a+rwX", "/work"], check=False, capture_output=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dev", "prod", "all"], default="all")
    mode = parser.parse_args().mode
    for selected in (["prod", "dev"] if mode == "all" else [mode]):
        verify(selected)
