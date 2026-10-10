# mtg4fun

Aplicação web para jogar Magic entre amigos. O repositório contém as
[especificações](docs/specs/README.md) e as [issues de implementação](docs/issues/).
A primeira entrega implementa contas provisionadas pelo responsável e acesso
por login e senha. Salas, decks e partidas serão entregues nas próximas issues.

## Organização do repositório

| Diretório | Responsabilidade |
| --- | --- |
| `api/` | Projeto Go: executável, módulos do backend, testes, `go.mod` e `go.sum`. |
| `app/` | Projeto React/TypeScript: telas, funcionalidades, estilos, testes e dependências npm. |
| `infra/` | Imagem Docker, Docker Compose e verificação da execução em containers. |
| `docs/` | Especificações, issues e decisões de implementação. |
| `scripts/` | Ferramentas de desenvolvimento, como gerenciamento de worktrees. |

```text
api/
  cmd/mtg4fun/          main.go inicia; serve.go e create_user.go executam comandos
  internal/auth/       accounts.go, sessions.go e handlers.go: acesso autenticado
  internal/database/   sqlite.go e schema.sql: conexão e esquema do banco
  internal/httpserver/ router.go, middleware.go e responses.go: HTTP compartilhado
  tests/integration/   access_test.go: comportamentos; fixtures_test.go: ambiente
app/
  src/main.tsx         Inicializa o React
  src/App.tsx          Compõe layout e telas conforme a sessão
  src/components/      AppLayout.tsx e seu CSS: estrutura visual compartilhada
  src/features/auth/   Telas, estado, chamadas HTTP e estilos de autenticação
  src/styles/          Estilos globais
  tests/e2e/           Fluxos reais no navegador e preparação do servidor de teste
infra/
  Dockerfile           Compila e empacota backend e frontend
  compose.yaml         Configura serviço, porta e volume persistente
  tests/               Verifica criação de conta e durabilidade com Docker
```

Dentro de cada projeto, organize o código por funcionalidade. `auth/` reúne
contas, senhas, sessões e seus endpoints; futuras funcionalidades recebem
módulos próprios quando implementadas. Nomes de arquivos descrevem suas
responsabilidades. `database` e `httpserver` concentram responsabilidades
compartilhadas; não crie pastas genéricas de utilitários ou módulos vazios.

O executável monta os módulos: abre o banco, constrói a autenticação e entrega
seu handler ao servidor HTTP. `httpserver` recebe um `http.Handler` e não importa
funcionalidades. No React, `sessionApi.ts` concentra o contrato HTTP, `useAuth.ts`
cuida do estado e as telas cuidam da apresentação.

Artefatos gerados ficam em `api/bin/`, `api/data/`, `app/dist/` e nos diretórios
de dependências e relatórios do frontend, todos ignorados pelo Git. Na raiz
ficam documentação de entrada e configuração do repositório. Há apenas um
módulo Go, em `api/`, sem workspace Go na raiz.

## Executar e criar contas

Requisitos: Docker com Docker Compose. Execute os comandos Docker a partir
da raiz deste checkout:

```bash
docker compose -f infra/compose.yaml -p mtg4fun up --build -d
# Digite uma senha de 8 a 72 bytes; ela não aparece no terminal ou histórico.
read -r -s -p 'Senha: ' account_password; echo
printf '%s' "$account_password" | docker compose -f infra/compose.yaml -p mtg4fun exec -T app mtg4fun create-user --login rafa --name 'Rafa' --password-stdin
unset account_password
```

Abra http://localhost:8080 e entre com o login e a senha criados. Não há
cadastro público. O nome é exibido após entrar; login aceita 3–64 letras ASCII,
números, ponto, hífen e sublinhado, diferenciando maiúsculas. Nome é obrigatório
(até 100 caracteres). Criar login duplicado falha, sem substituir a conta.

```bash
docker compose -f infra/compose.yaml -p mtg4fun restart app
# Ou parar e subir novamente, preservando o volume:
docker compose -f infra/compose.yaml -p mtg4fun down
docker compose -f infra/compose.yaml -p mtg4fun up -d
```

O volume `mtg4fun_data` conserva contas e sessões. `down -v` remove esse volume.
Use o mesmo nome de projeto em todos os comandos de um ambiente. Para outro
checkout, use projeto e porta próprios: `PORT=8081 docker compose -f infra/compose.yaml -p mtg4fun-01-contas up --build -d`. Use esse projeto também para criar contas.

A publicação padrão aceita conexões somente no computador local. Para acesso
pela rede, configure `BIND_ADDR=0.0.0.0`. Na hospedagem HTTPS com proxy reverso,
configure `COOKIE_SECURE=true` e exponha a aplicação pela mesma origem do
cliente. SQLite e bcrypt (custo 12), sessões e API estão documentados em
[decisões de acesso](docs/decisions/01-acesso.md).

## Desenvolvimento e verificações

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

## Fluxo de desenvolvimento: branch, commits e PR

Toda tarefa usa uma branch própria, inclusive quando executada sem outras
tarefas em paralelo. **Jamais faça commits na `master`.** Use a branch
atribuída pelo usuário. Se nenhuma tiver sido atribuída, crie uma antes de
editar:

```bash
git switch -c feat/01-contas master
```

Antes de editar e antes de cada commit, confira o checkout:

```bash
pwd
git status
git branch --show-current
```

Se estiver na `master`, troque para a branch da tarefa antes de prosseguir.
Adicione ao stage apenas arquivos da tarefa, faça conventional commits e rode
as verificações pertinentes. Ao concluir, publique a branch e abra um PR para
a `master`:

```bash
git commit -m "feat(auth): criar contas e autenticar convidados"
git push -u origin HEAD
gh pr create --base master --fill
```

Revise o título e a descrição do PR para explicar o comportamento entregue e
as verificações realizadas. **Deixe o PR aberto, sem merge, para o usuário
revisar.** Não faça merge local, merge do PR ou habilite auto-merge. A integração
é responsabilidade do usuário. Preserve a branch enquanto o PR aguarda revisão.

## Trabalhos em paralelo com Git worktrees

Requisitos: Git e Bash. Para tarefas paralelas, cada tarefa tem sua branch e
seu diretório de trabalho. Os checkouts ficam ao lado do repositório principal,
em `../mtg4fun-worktrees/`, sem misturar os arquivos das tarefas.

No checkout principal:

```bash
./scripts/worktree.sh create 01-contas master
./scripts/worktree.sh create 02-decks master
./scripts/worktree.sh list
```

Isso cria as branches `work/01-contas` e `work/02-decks` a partir da `master` e os
diretórios `../mtg4fun-worktrees/01-contas` e `../mtg4fun-worktrees/02-decks`.
Abra cada diretório em um terminal, editor ou sessão de agente independente:

```bash
cd ../mtg4fun-worktrees/01-contas
pwd
git status
git branch --show-current
# Implementar, verificar, fazer conventional commits e abrir PR nesta branch.
```

O script também funciona a partir de uma worktree, usando o mesmo diretório
externo. Sem uma base explícita, usa o `HEAD` do checkout atual; informe `master`
para iniciar uma tarefa independente sem incluir alterações de outra branch.

Somente arquivos commitados na base aparecem no novo checkout. Se o script
não estiver disponível na base, execute-o pelo caminho absoluto do checkout
que contém o script, mantendo o terminal no checkout cuja base deseja usar.

## Encerrar o trabalho sem integrar

Após publicar a branch e abrir o PR, uma worktree temporária sem alterações
locais pode ser removida. Essa operação preserva a branch e não faz merge:

```bash
./scripts/worktree.sh remove 01-contas
```

`remove` recusa checkouts com alterações locais ou bloqueados. Não exclua a
branch enquanto o PR aguarda revisão. Para retomar uma branch preservada,
execute novamente `create` com o mesmo nome, sem informar uma base.

Cada branch só pode estar aberta em uma worktree por vez. Combine a divisão
das tarefas quando houver arquivos em comum; worktrees isolam os checkouts,
mas conflitos ainda podem ocorrer na revisão e integração pelo usuário.
Configuração e histórico do Git são compartilhados entre elas.

Instale dependências por checkout e use portas, arquivos `.env`, bancos e
volumes próprios para cada ambiente. Com Docker Compose, use um nome de
projeto distinto por tarefa (`docker compose -f infra/compose.yaml -p mtg4fun-01-contas ...`) e portas
diferentes para os serviços publicados.
