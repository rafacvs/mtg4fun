#!/bin/sh
# Executado na VM pelo workflow de deploy, depois de `docker load` das imagens
# mtg4fun-release-{api,app}:<tag>. Uso: sh deploy.sh <diretório com .env> <tag>
set -eu

deploy_path=$1
tag=$2
keep_releases=3

cd "$deploy_path"
test -f .env || { echo "Arquivo .env ausente em $deploy_path." >&2; exit 1; }

# Produção usa somente o compose base, mesmo se o .env apontar outro arquivo.
export COMPOSE_FILE=infra/compose.yaml

case $(uname -m) in
  x86_64) host_arch=amd64 ;;
  aarch64) host_arch=arm64 ;;
  *) host_arch=$(uname -m) ;;
esac
image_arch=$(docker image inspect -f '{{.Architecture}}' "mtg4fun-release-api:$tag")
if [ "$image_arch" != "$host_arch" ]; then
  echo "Imagem $image_arch incompatível com a VM $host_arch; ajuste DEPLOY_ARCH." >&2
  exit 1
fi

# O Compose usa <projeto>-<serviço>:latest para serviços com build.
api_image=$(docker compose config --images | grep -e '-api$')
app_image=$(docker compose config --images | grep -e '-app$')
previous_api=$(docker image inspect -f '{{.Id}}' "$api_image" 2>/dev/null || true)

docker tag "mtg4fun-release-api:$tag" "$api_image"
if ! docker compose run --rm api migrate up; then
  echo "Migration falhou; os containers em execução foram mantidos." >&2
  if [ -n "$previous_api" ]; then
    docker tag "$previous_api" "$api_image"
  fi
  exit 1
fi

docker tag "mtg4fun-release-app:$tag" "$app_image"
docker compose up -d --no-build api app
docker compose ps api app

for release in mtg4fun-release-api mtg4fun-release-app; do
  docker images "$release" --format '{{.Tag}}' | tail -n +$((keep_releases + 1)) \
    | while read -r old; do docker rmi "$release:$old" >/dev/null; done
done
