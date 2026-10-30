#!/bin/sh
# Executado na VM pelo workflow de deploy, depois de `docker load` das imagens
# mtg4fun-release-{api,app}:<tag>. Uso: sh deploy.sh <diretório com .env> <tag>
set -eu

# O script chega pelo stdin do SSH: a função garante a leitura completa antes de
# executar e impede que os comandos do Docker consumam o restante dele.
main() {
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

  # A verificação passa pelo Nginx: / serve o frontend e /api/session sem login responde 401.
  for service in api app; do
    running=$(docker inspect -f '{{.Image}}' "$(docker compose ps -q "$service")")
    expected=$(docker image inspect -f '{{.Id}}' "mtg4fun-release-$service:$tag")
    if [ "$running" != "$expected" ]; then
      echo "O serviço $service não está executando a imagem $tag." >&2
      exit 1
    fi
  done

  attempt=0
  until docker compose exec -T app wget -q -O /dev/null http://127.0.0.1:8080/ 2>/dev/null \
    && docker compose exec -T app wget -S -O /dev/null http://127.0.0.1:8080/api/session 2>&1 | grep -q ' 401 '; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "Produção não respondeu como esperado depois do deploy." >&2
      docker compose logs --tail 30 api app >&2
      exit 1
    fi
    sleep 2
  done
  echo "Verificação concluída: frontend e API respondendo na versão $tag."

  for release in mtg4fun-release-api mtg4fun-release-app; do
    docker images "$release" --format '{{.Tag}}' | tail -n +$((keep_releases + 1)) \
      | while read -r old; do docker rmi "$release:$old" >/dev/null; done
  done
}

main "$@" </dev/null
