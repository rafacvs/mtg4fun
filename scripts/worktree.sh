#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Uso:
  scripts/worktree.sh create <nome> [base]
  scripts/worktree.sh isolate <nome>
  scripts/worktree.sh list
  scripts/worktree.sh remove <nome>

Cria a branch work/<nome> em ../mtg4fun-worktrees/<nome> e copia o banco
principal para um banco novo no MySQL já em execução. isolate prepara worktrees
existentes. Ao reabrir uma worktree, esse banco é preservado.
HELP
}

fail() {
  printf 'Erro: %s\n' "$*" >&2
  exit 1
}

action=${1:-help}
case "$action" in
  help|-h|--help) usage; exit 0 ;;
  create) [[ $# -ge 2 && $# -le 3 ]] || { usage >&2; exit 1; } ;;
  isolate|remove) [[ $# -eq 2 ]] || { usage >&2; exit 1; } ;;
  list) [[ $# -eq 1 ]] || { usage >&2; exit 1; } ;;
  *) usage >&2; exit 1 ;;
esac

worktrees=$(git worktree list --porcelain)
first_line=${worktrees%%$'\n'*}
[[ "$first_line" == 'worktree '* ]] || fail 'Checkout principal não encontrado.'
main_root=${first_line#worktree }
worktree_root="$(dirname "$main_root")/$(basename "$main_root")-worktrees"

if [[ "$action" == list ]]; then
  git worktree list
  exit 0
fi

name=$2
[[ "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]] ||
  fail 'Use um nome com letras, números, hífens e underscores, começando com letra ou número.'
branch="work/$name"
target="$worktree_root/$name"
project="mtg4fun-${name,,}"
database="mtg4fun_${name//-/_}"
database="${database,,}"
[[ ${#database} -le 64 ]] || fail "O nome produz um banco maior que 64 caracteres."

compose_at() (
  cd "$1"
  shift
  env -u COMPOSE_PROJECT_NAME -u COMPOSE_FILE -u COMPOSE_PROFILES \
    -u PORT -u MYSQL_PORT -u DB_HOST -u DB_PORT docker compose "$@"
)

choose_ports() {
  python3 - "$main_root" "$worktree_root" <<'PY'
from pathlib import Path
import re
import socket
import sys

used = set()
for file in [Path(sys.argv[1]) / '.env', *Path(sys.argv[2]).glob('*/.env')]:
    if file.exists():
        for match in re.finditer(r'^(?:PORT|MYSQL_PORT)=(\d+)$', file.read_text(), re.M):
            used.add(int(match.group(1)))

def available(port):
    if port in used:
        return False
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', port))
        except OSError:
            return False
    return True

port = 8081
while not available(port):
    port += 1
print(port)
PY
}

configure_environment() {
  local source="$target/.env"
  if [[ ! -f "$source" ]]; then
    [[ -f "$main_root/.env" ]] || fail "Configure primeiro $main_root/.env."
    source="$main_root/.env"
  fi
  local current_project current_database
  current_project=$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$source" | tail -n 1)
  current_database=$(sed -n 's/^DB_NAME=//p' "$source" | tail -n 1)
  if [[ "$current_project" == "$project" && "$current_database" == "$database" ]]; then
    local actual
    actual=$(compose_at "$target" config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')
    [[ "$actual" == "$project" ]] || fail "Compose resolveu $actual, esperado $project. Verifique COMPOSE_PROJECT_NAME do shell."
    return
  fi
  local port temporary actual
  port=$(choose_ports)
  temporary=$(mktemp "$target/.env.XXXXXX")
  chmod 600 "$temporary"
  awk -F= '!($1 == "COMPOSE_PROJECT_NAME" || $1 == "COMPOSE_FILE" || $1 == "COMPOSE_PROFILES" || $1 == "PORT" || $1 == "MYSQL_PORT" || $1 == "DB_HOST" || $1 == "DB_PORT" || $1 == "DB_NAME" || $1 == "DB_USER")' "$source" > "$temporary"
  {
    printf '\nCOMPOSE_PROJECT_NAME=%s\n' "$project"
    printf 'COMPOSE_FILE=infra/compose.yaml:infra/compose.dev.yaml:infra/compose.worktree.yaml\n'
    printf 'COMPOSE_PROFILES=\n'
    printf 'DB_HOST=mtg4fun-mysql\nDB_PORT=3306\n'
    printf 'DB_NAME=%s\nDB_USER=%s\n' "$database" "$database"
    printf 'PORT=%s\n' "$port"
  } >> "$temporary"
  mv "$temporary" "$target/.env"
  actual=$(compose_at "$target" config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')
  [[ "$actual" == "$project" ]] || fail "Compose resolveu $actual, esperado $project. Verifique COMPOSE_PROJECT_NAME do shell."
  printf 'Ambiente isolado: projeto %s, HTTP %s, banco %s\n' "$project" "$port" "$database"
}

root_mysql() {
  local source_id
  source_id=$(compose_at "$main_root" ps -q mysql)
  [[ -n "$source_id" ]] || fail "O MySQL principal precisa estar em execução. Após iniciá-lo, repita com isolate $name."
  if ! docker network inspect mtg4fun-db >/dev/null 2>&1; then
    docker network create mtg4fun-db >/dev/null
  fi
  if ! docker inspect "$source_id" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' | grep -qw mtg4fun-db; then
    docker network connect --alias mtg4fun-mysql mtg4fun-db "$source_id"
  fi
  printf '%s' "$source_id"
}

mysql_exec() {
  local container=$1
  shift
  docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -u root "$@"' mysql "$@"
}

mysql_import() {
  local container=$1
  shift
  docker exec -i "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -u root "$@"' mysql "$@"
}

seed_database() {
  local source_id existing
  source_id=$(root_mysql)
  existing=$(mysql_exec "$source_id" -N -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '${database}'")
  existing=${existing//$'\n'/}
  if [[ "$existing" == 1 ]]; then
    printf 'Banco existente preservado: %s\n' "$database"
    return
  fi
  local snapshot sql
  snapshot=$(mktemp)
  sql=$(mktemp)
  chmod 600 "$snapshot" "$sql"
  if ! (
    set -euo pipefail
    trap 'rm -f "$snapshot" "$sql"' EXIT
    docker exec "$source_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --quick --set-gtid-purged=OFF --routines --triggers --events -u root "$MYSQL_DATABASE"' > "$snapshot"
    [[ -s "$snapshot" ]]
    python3 - "$main_root/.env" "$database" "$sql" <<'PY'
from pathlib import Path
import sys
env_path, database, destination = sys.argv[1:]
password = ""
for line in Path(env_path).read_text().splitlines():
    if line.startswith("DB_PASSWORD="):
        password = line.split("=", 1)[1]
        if len(password) >= 2 and password[0] == password[-1] and password[0] in "'\"":
            password = password[1:-1]
        break
else:
    raise SystemExit("DB_PASSWORD ausente no .env principal")
if password == "":
    raise SystemExit("DB_PASSWORD ausente no .env principal")
literal = "'" + password.replace("\\", "\\\\").replace("'", "''") + "'"
Path(destination).write_text(
    f"CREATE DATABASE `{database}`;\n"
    f"CREATE USER '{database}'@'%' IDENTIFIED BY {literal};\n"
    f"GRANT ALL PRIVILEGES ON `{database}`.* TO '{database}'@'%';\n"
)
PY
    mysql_import "$source_id" < "$sql"
    mysql_import "$source_id" "$database" < "$snapshot"
  ); then
    mysql_exec "$source_id" -e "DROP DATABASE IF EXISTS \`${database}\`; DROP USER IF EXISTS '${database}'@'%';" >/dev/null 2>&1 || true
    rm -f "$snapshot" "$sql"
    fail "Não foi possível copiar o banco para $database; o principal permanece intacto. Repita com isolate $name."
  fi
  rm -f "$snapshot" "$sql"
  printf 'Snapshot do banco principal copiado para %s.\n' "$database"
}

case "$action" in
  create)
    [[ ! -e "$target" && ! -L "$target" ]] || fail "O caminho já existe: $target"
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      [[ $# -eq 2 ]] || fail 'A branch já existe; omita a base para reabri-la.'
      git worktree add "$target" "$branch"
    else
      base=${3:-HEAD}
      git rev-parse --verify --end-of-options "${base}^{commit}" >/dev/null
      git worktree add -b "$branch" "$target" "$base"
    fi
    configure_environment
    seed_database
    printf '\nWorktree pronta: %s\nBranch: %s\n' "$target" "$branch"
    ;;
  isolate)
    [[ -d "$target" ]] || fail "Worktree não encontrada: $target"
    [[ "$(git -C "$target" branch --show-current)" == "$branch" ]] || fail "Branch inesperada em $target"
    configure_environment
    seed_database
    ;;
  remove)
    git worktree remove "$target"
    printf 'Checkout removido. Branch e banco preservados: %s, %s\n' "$branch" "$database"
    ;;
esac
