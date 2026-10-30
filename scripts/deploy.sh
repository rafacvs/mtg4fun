#!/usr/bin/env bash
# Deploy de produção a partir desta máquina, com os mesmos passos do workflow.
# Uso: scripts/deploy.sh [commit, branch ou tag]; o padrão é o HEAD.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
config=${DEPLOY_CONFIG:-$root/.env.deploy}

fail() {
  printf 'Erro: %s\n' "$*" >&2
  exit 1
}

[[ $# -le 1 ]] || fail "uso: scripts/deploy.sh [commit, branch ou tag]"
[[ -f $config ]] || fail "crie $config com SSH_KEY, SSH_TARGET e DEPLOY_PATH (veja o README)."
# shellcheck disable=SC1090
source "$config"
[[ -n ${SSH_KEY:-} && -n ${SSH_TARGET:-} && -n ${DEPLOY_PATH:-} ]] \
  || fail "defina SSH_KEY, SSH_TARGET e DEPLOY_PATH em $config."

tag=$(git -C "$root" rev-parse --verify "${1:-HEAD}^{commit}") || fail "referência inválida: ${1:-HEAD}"
api_image=mtg4fun-release-api:$tag
app_image=mtg4fun-release-app:$tag
remote_path=$(printf '%q' "$DEPLOY_PATH")

remote() {
  ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    -o ServerAliveInterval=30 "$SSH_TARGET" "$@"
}

cleanup() {
  docker rmi "$api_image" "$app_image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

case $(remote uname -m) in
  x86_64) platform=linux/amd64 ;;
  aarch64) platform=linux/arm64 ;;
  *) fail "arquitetura da VM não suportada." ;;
esac

printf 'Publicando %s em %s (%s)\n' "$tag" "$SSH_TARGET" "$platform"
# O contexto é o commit exportado: alterações locais não commitadas não vão para produção.
build_target() {
  git -C "$root" archive "$tag" \
    | docker build --platform "$platform" -f infra/Dockerfile --target "$1" -t "$2" -
}
build_target api-production "$api_image"
build_target frontend-production "$app_image"

docker save "$api_image" "$app_image" | gzip | remote 'gunzip | docker load'
git -C "$root" show "$tag:infra/compose.yaml" \
  | remote "mkdir -p $remote_path/infra && cat > $remote_path/infra/compose.yaml"
git -C "$root" show "$tag:infra/deploy.sh" | remote sh -s -- "$remote_path" "$tag"
