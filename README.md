# mtg4fun

Aplicação web para jogar Magic entre amigos. O repositório contém as
[especificações](docs/specs/README.md) e as [issues de implementação](docs/issues/).
A primeira entrega implementa contas provisionadas pelo responsável e acesso
por login e senha. Salas, decks e partidas serão entregues nas próximas issues.

## Executar e criar contas

Requisitos: Docker com Docker Compose. No diretório deste checkout:

```bash
docker compose -p mtg4fun up --build -d
# Digite uma senha de 8 a 72 bytes; ela não aparece no terminal ou histórico.
read -r -s -p 'Senha: ' account_password; echo
printf '%s' "$account_password" | docker compose -p mtg4fun exec -T app mtg4fun create-user --login rafa --name 'Rafa' --password-stdin
unset account_password
```

Abra http://localhost:8080 e entre com o login e a senha criados. Não há
cadastro público. O nome é exibido após entrar; login aceita 3–64 letras ASCII,
números, ponto, hífen e sublinhado, diferenciando maiúsculas. Nome é obrigatório
(até 100 caracteres). Criar login duplicado falha, sem substituir a conta.

```bash
docker compose -p mtg4fun restart app
# Ou parar e subir novamente, preservando o volume:
docker compose -p mtg4fun down
docker compose -p mtg4fun up -d
```

O volume `mtg4fun_data` conserva contas e sessões. `down -v` remove esse volume.
Use o mesmo nome de projeto em todos os comandos de um ambiente. Para outro
checkout, use projeto e porta próprios: `PORT=8081 docker compose -p
mtg4fun-01-contas up --build -d`. Use esse projeto também para criar contas.

A publicação padrão aceita conexões somente no computador local. Para acesso
pela rede, configure `BIND_ADDR=0.0.0.0`. Na hospedagem HTTPS com proxy reverso,
configure `COOKIE_SECURE=true` e exponha a aplicação pela mesma origem do
cliente. SQLite e bcrypt (custo 12), sessões e API estão documentados em
[decisões de acesso](docs/decisions/01-acesso.md).

## Desenvolvimento e verificações

Requisitos locais: Go 1.26+, GCC (driver SQLite usa CGO), Node 22.12+ e npm.

```bash
npm ci --prefix web
npm run build --prefix web
go build -o bin/mtg4fun ./cmd/mtg4fun
read -r -s -p 'Senha: ' account_password; echo
printf '%s' "$account_password" | bin/mtg4fun create-user --login rafa --name Rafa --password-stdin
unset account_password
bin/mtg4fun serve
```

Em outro terminal, `npm run dev --prefix web` oferece recarga automática em
http://localhost:5173 e encaminha `/api` para o Go na porta 8080. Variáveis:
`DB_PATH` (padrão `data/mtg4fun.db`), `ADDR` (`:8080`), `WEB_DIR` (`web/dist`)
e `COOKIE_SECURE` (`false`). Também existem flags `--db`, `--addr` e `--web`.

```bash
npm run typecheck --prefix web
go vet ./...
go test ./...
npm exec --prefix web -- playwright install chromium
npm test --prefix web
```

Os testes usam bancos temporários próprios. Playwright inicia um servidor Go
isolado em uma porta aleatória e testa desktop e celular com o cliente compilado
(`npm run build --prefix web` antes dos testes). Não usa contas do seu ambiente.

Para verificar a imagem e a durabilidade do volume Docker (Python 3 e Docker):

```bash
python3 tests/docker_smoke.py
```

Essa verificação cria projeto, porta, conta e volume temporários e remove o
ambiente ao terminar. Não altera as contas do serviço em uso.

## Trabalhos em paralelo com Git worktrees

Requisitos: Git e Bash. Cada tarefa tem sua branch e seu diretório de trabalho.
Os checkouts ficam ao lado do repositório principal, em `../mtg4fun-worktrees/`,
sem misturar os arquivos das tarefas.

No checkout principal:

```bash
./scripts/worktree.sh create 01-contas
./scripts/worktree.sh create 02-decks
./scripts/worktree.sh list
```

Isso cria as branches `work/01-contas` e `work/02-decks` a partir de `HEAD` e os
diretórios `../mtg4fun-worktrees/01-contas` e `../mtg4fun-worktrees/02-decks`.
Abra cada diretório em um terminal, editor ou sessão de agente independente:

```bash
cd ../mtg4fun-worktrees/01-contas
git status
# Implementar, verificar e fazer commits nesta branch.
```

O script também funciona a partir de uma worktree, usando o mesmo diretório
externo. A base padrão é o `HEAD` do checkout atual. Para escolher outra base:

```bash
./scripts/worktree.sh create 03-salas master
```

Somente arquivos commitados na base aparecem no novo checkout. Faça commit
desta configuração para que o script e as instruções também estejam disponíveis
nas novas worktrees. Até lá, execute o script pelo caminho absoluto do checkout
principal, mantendo o terminal no checkout cuja base deseja usar.

## Integrar e encerrar uma tarefa

Depois de revisar e verificar os commits, integre a branch pelo fluxo de PR do
projeto ou localmente no checkout principal:

```bash
git switch master
git merge work/01-contas
./scripts/worktree.sh remove 01-contas
git branch -d work/01-contas
```

`remove` recusa checkouts com alterações locais ou bloqueados e preserva a
branch. A exclusão da branch é um passo separado; `git branch -d` verifica se
ela foi integrada. Para retomar uma branch preservada, execute novamente
`create` com o mesmo nome, sem informar uma base.

Cada branch só pode estar aberta em uma worktree por vez. Combine a divisão
das tarefas quando houver arquivos em comum; worktrees isolam os checkouts,
mas conflitos ainda podem ocorrer na integração. Configuração e histórico do
Git são compartilhados entre elas.

Quando a aplicação existir, instale dependências por checkout e use portas,
arquivos `.env`, bancos e volumes próprios para cada ambiente. Com Docker
Compose, use um nome de projeto distinto por tarefa (`docker compose -p
mtg4fun-01-contas ...`) e portas diferentes para os serviços publicados.
