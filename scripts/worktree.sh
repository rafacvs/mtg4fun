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
principal para um projeto Compose isolado. isolate prepara worktrees existentes.
Ao reabrir uma worktree, o volume existente é preservado.
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

ports = []
for start in (8081, 3308):
    port = start
    while not available(port) or port in ports:
        port += 1
    ports.append(port)
print(*ports)
PY
}

configure_environment() {
  local source="$target/.env"
  if [[ ! -f "$source" ]]; then
    [[ -f "$main_root/.env" ]] || fail "Configure primeiro $main_root/.env."
    source="$main_root/.env"
  fi
  local current_project
  current_project=$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$source" | tail -n 1)
  if [[ "$current_project" == "$project" ]]; then
    local actual
    actual=$(compose_at "$target" config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')
    [[ "$actual" == "$project" ]] || fail "Compose resolveu $actual, esperado $project. Verifique COMPOSE_PROJECT_NAME do shell."
    return
  fi
  local port mysql_port temporary actual
  read -r port mysql_port < <(choose_ports)
  temporary=$(mktemp "$target/.env.XXXXXX")
  chmod 600 "$temporary"
  awk -F= '!($1 == "COMPOSE_PROJECT_NAME" || $1 == "COMPOSE_FILE" || $1 == "COMPOSE_PROFILES" || $1 == "PORT" || $1 == "MYSQL_PORT" || $1 == "DB_HOST" || $1 == "DB_PORT")' "$source" > "$temporary"
  {
    printf '\nCOMPOSE_PROJECT_NAME=%s\n' "$project"
    printf 'COMPOSE_FILE=infra/compose.yaml:infra/compose.dev.yaml\n'
    printf 'COMPOSE_PROFILES=local-db\n'
    printf 'DB_HOST=mysql\nDB_PORT=3306\n'
    printf 'PORT=%s\nMYSQL_PORT=%s\n' "$port" "$mysql_port"
  } >> "$temporary"
  mv "$temporary" "$target/.env"
  actual=$(compose_at "$target" config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')
  [[ "$actual" == "$project" ]] || fail "Compose resolveu $actual, esperado $project. Verifique COMPOSE_PROJECT_NAME do shell."
  printf 'Ambiente isolado: projeto %s, HTTP %s, MySQL %s\n' "$project" "$port" "$mysql_port"
}

seed_database() {
  local volume="${project}_mysql-data"
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    printf 'Volume existente preservado: %s\n' "$volume"
    return
  fi
  local source_id
  source_id=$(compose_at "$main_root" ps -q mysql)
  [[ -n "$source_id" ]] || fail "O MySQL principal precisa estar em execução. Após iniciá-lo, repita com isolate $name."
  if ! (
    set -euo pipefail
    snapshot=$(mktemp)
    trap 'rm -f "$snapshot"' EXIT
    chmod 600 "$snapshot"
    docker exec "$source_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --quick --set-gtid-purged=OFF --routines --triggers --events -u root "$MYSQL_DATABASE"' > "$snapshot"
    [[ -s "$snapshot" ]]
    compose_at "$target" up -d mysql
    destination_id=$(compose_at "$target" ps -q mysql)
    ready=false
    for _ in {1..600}; do
      if docker exec "$destination_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -u root -e "SELECT 1"' >/dev/null 2>&1; then ready=true; break; fi
      sleep 1
    done
    [[ "$ready" == true ]]
    docker exec -i "$destination_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -u root "$MYSQL_DATABASE"' < "$snapshot"
  ); then
    compose_at "$target" down --volumes >/dev/null 2>&1 || true
    fail "Não foi possível copiar o banco para $project; o principal permanece intacto. Repita com isolate $name."
  fi
  printf 'Snapshot do banco principal copiado para %s.\n' "$volume"
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
    printf 'Checkout removido. Branch e volume preservados: %s, %s_mysql-data\n' "$branch" "$project"
    ;;
esac
