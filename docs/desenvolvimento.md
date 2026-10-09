# Desenvolvimento e verificações

Este guia descreve o desenvolvimento local disponível hoje, fora do Docker.
Para executar a aplicação em containers, consulte o [README](../README.md#executar-com-docker).
As regras para agentes ficam no [AGENTS.md](../AGENTS.md).

## Situação atual e ambiente desejado

O Compose atual executa somente a imagem com frontend compilado. Não oferece
modo dev nem hot reload. O desenvolvimento local usa Vite com hot reload do
React; alterações no backend exigem recompilar e reiniciar o processo Go.
Mesmo nesse fluxo, o backend exige `app/dist/index.html` para iniciar, por isso
há um build inicial do frontend antes de usar o Vite.

O ambiente desejado deve oferecer modos Docker distintos de desenvolvimento
(com hot reload) e produção (com build), sem instalar Go ou Node no host.
A [issue 20](issues/20-docker-dev-e-producao.md) acompanha essa correção.
SQLite é uma limitação da implementação atual, rejeitada pelo usuário;
sua substituição depende da [issue 19](issues/19-substituir-sqlite.md).

## Executar localmente

Requisitos locais: Go 1.26+, GCC (driver SQLite usa CGO), Node 22.12+ e npm.
Comece na raiz; após compilar o frontend, entre em `api/` para executar o backend:

```bash
npm ci --prefix app
npm run build --prefix app
cd api
go build -o bin/mtg4fun ./cmd/mtg4fun
read -r -s -p 'Senha: ' account_password; echo
printf '%s' "$account_password" | bin/mtg4fun create-user --login rafa --name Rafa --password-stdin
unset account_password
bin/mtg4fun serve
```

Em outro terminal, a partir da raiz, `npm run dev --prefix app` oferece
recarga automática em http://localhost:5173 e encaminha `/api` para o Go na porta 8080. Variáveis:
`DB_PATH` (padrão `data/mtg4fun.db`, dentro de `api/`), `ADDR` (`:8080`),
`WEB_DIR` (`../app/dist`) e `COOKIE_SECURE` (`false`). Também existem flags `--db`, `--addr` e `--web`.
O backend local é executado com `api/` como diretório de trabalho. Se já tiver
um banco em `data/mtg4fun.db` na raiz, use `--db ../data/mtg4fun.db` para continuar
usando esse arquivo sem migrar ou recriar contas.

## Verificações

Da raiz do repositório, rode as verificações:

```bash
npm run typecheck --prefix app
go -C api vet ./...
go -C api test ./...
npm exec --prefix app -- playwright install chromium
npm test --prefix app
```

Os testes usam bancos temporários próprios. Playwright inicia um servidor Go
isolado em uma porta aleatória e testa desktop e celular com o cliente compilado
(`npm run build --prefix app` antes dos testes). Não usa contas do seu ambiente.

Para verificar a imagem e a durabilidade do volume Docker (Python 3 e Docker):

```bash
python3 infra/tests/docker_smoke.py
```

Essa verificação cria projeto, porta, conta e volume temporários e remove o
ambiente ao terminar. Não altera as contas do serviço em uso.

