#!/usr/bin/env python3
"""Start an isolated real MySQL for executable and browser tests.

Print connection information as JSON. The caller must remove the returned
container with docker rm -f -v, including when its tests fail.
"""
import json
import secrets
import subprocess
import time


def run(*args):
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout.strip()


def start():
    name = "mtg4fun-test-mysql-" + secrets.token_hex(6)
    password = secrets.token_hex(24)
    try:
        run("docker", "run", "--detach", "--rm", "--name", name,
            "--tmpfs", "/var/lib/mysql:rw,nosuid,size=1g",
            "--publish", "127.0.0.1::3306", "--env", f"MYSQL_ROOT_PASSWORD={password}",
            "--env", "MYSQL_ROOT_HOST=%", "--env", "MYSQL_DATABASE=mtg4fun",
            "mysql:26.7.0")
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            probe = subprocess.run(
                ["docker", "exec", "--env", f"MYSQL_PWD={password}", name,
                 "mysql", "--protocol=TCP", "-h", "127.0.0.1", "-u", "root", "-e", "SELECT 1"],
                capture_output=True, timeout=10,
            )
            if probe.returncode == 0:
                port = run("docker", "port", name, "3306/tcp").rsplit(":", 1)[1]
                return {"container": name, "DB_HOST": "127.0.0.1", "DB_PORT": port,
                        "DB_USER": "root", "DB_PASSWORD": password, "DB_NAME": "mtg4fun", "DB_TLS": "false"}
            time.sleep(0.5)
        logs = run("docker", "logs", name)
        raise RuntimeError("MySQL de teste não ficou pronto: " + logs)
    except BaseException:
        subprocess.run(["docker", "rm", "-f", "-v", name], capture_output=True)
        raise


if __name__ == "__main__":
    print(json.dumps(start()))
