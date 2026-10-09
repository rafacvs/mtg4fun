#!/usr/bin/env python3
"""Verify the shipped image, provisioning command and durable Docker volume."""
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PROJECT = f"mtg4fun-auth-test-{os.getpid()}"
with socket.socket() as listener:
    listener.bind(("127.0.0.1", 0))
    PORT = listener.getsockname()[1]
ENV = {**os.environ, "PORT": str(PORT), "BIND_ADDR": "127.0.0.1", "COOKIE_SECURE": "false"}
URL = f"http://127.0.0.1:{PORT}"
COOKIES = http.cookiejar.CookieJar()
CLIENT = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(COOKIES))


def compose(*args, input=None):
    result = subprocess.run(
        ["docker", "compose", "-f", str(ROOT / "infra/compose.yaml"), "-p", PROJECT, *args], cwd=ROOT, env=ENV,
        input=input, text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(f"Docker Compose falhou: {result.stdout}\n{result.stderr}")
    return result.stdout


def request(method="GET", path="/api/session", data=None):
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Content-Type": "application/json"} if body else {}
    req = urllib.request.Request(URL + path, data=body, headers=headers, method=method)
    try:
        response = CLIENT.open(req, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read()


def ready():
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            if request(path="/")[0] == 200:
                return
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(0.1)
    raise RuntimeError("Servidor Docker não ficou pronto")


def require_status(actual, expected):
    if actual[0] != expected:
        raise AssertionError(f"HTTP {actual[0]}, esperado {expected}: {actual[1]!r}")


try:
    print("Construindo e iniciando Docker em ambiente isolado...", flush=True)
    compose("up", "--build", "-d")
    ready()
    require_status(request(), 401)
    compose("exec", "-T", "app", "mtg4fun", "create-user", "--login", "convidado",
            "--name", "Convidado Docker", "--password", "senha-exclusiva-do-teste")
    credentials = {"login": "convidado", "password": "senha-exclusiva-do-teste"}
    require_status(request("POST", data={**credentials, "password": "senha-incorreta"}), 401)
    require_status(request("POST", data=credentials), 200)
    first = request()
    require_status(first, 200)
    if json.loads(first[1])["user"]["name"] != "Convidado Docker":
        raise AssertionError("Conta criada não foi autenticada")
    print("Recriando o serviço sem remover o volume...", flush=True)
    compose("down")
    compose("up", "-d")
    ready()
    after_restart = request()
    require_status(after_restart, 200)
    if after_restart[1] != first[1]:
        raise AssertionError("Identidade mudou após reinício")
    require_status(request("DELETE"), 204)
    require_status(request(), 401)
    require_status(request("POST", data=credentials), 200)
    print("Docker: criação de conta, autenticação, durabilidade e saída verificadas.", flush=True)
finally:
    compose("down", "-v", "--rmi", "local")
