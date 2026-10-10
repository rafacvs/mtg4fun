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
            while time.monotonic() < deadline:
                try:
                    if request(path="/")[0] == 200 and request()[0] in (200, 401):
                        return
                except (OSError, urllib.error.URLError):
                    pass
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
            if mode == "dev":
                browser_env["E2E_HOT_RELOAD_ROOT"] = staging
                subprocess.run(["npm", "test", "--prefix", "app", "--", "hot-reload.spec.ts", "--project=desktop", "--workers=1"],
                               cwd=ROOT, env=browser_env, check=True)
            print(f"{mode}: recriando todos os serviços e reutilizando o volume...", flush=True)
            compose("down")
            compose("up", "--detach", "api", "app")
            ready()
            after_restart = request()
            require(after_restart, 200)
            if after_restart[1] != first[1]:
                raise AssertionError("Sessão/identidade não sobreviveu à recriação")
            require(request("DELETE"), 204)
            require(request(), 401)
            require(request("POST", data=credentials), 200)
            print(f"{mode}: navegador, API, conta, sessão, recriação e logout verificados.", flush=True)
        except BaseException:
            print(compose("logs", "--no-color", "--tail=60", check=False), flush=True)
            raise
        finally:
            compose("down", "--volumes", "--rmi", "local")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dev", "prod", "all"], default="all")
    mode = parser.parse_args().mode
    for selected in (["prod", "dev"] if mode == "all" else [mode]):
        verify(selected)
