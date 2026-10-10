# mtg4fun

Aplicação web para jogar Magic online entre amigos, com interface PT-BR para
computador e celular. A proposta é uma mesa manual: os jogadores controlam
cartas e ações, sem motor de regras de Magic.

O backend usa Go e o frontend usa React/TypeScript. As
[especificações](docs/specs/README.md) descrevem a primeira versão completa;
as [issues](docs/issues/) dividem sua implementação.

## Estado do projeto

A implementação atual permite criar contas pelo executável e entrar e sair
pelo navegador, com persistência de contas e sessões. Não há cadastro público.
Salas, decks e partidas ainda não estão implementados.

## Executar com Docker

Requisitos: Docker com Docker Compose. Execute os comandos a partir da raiz.
Go, Node e MySQL são instalados dentro das imagens, sem builds manuais no host.

Copie a configuração e defina senhas locais diferentes para a aplicação e root:

```bash
cp .env.example .env
```

Edite `DB_PASSWORD` e `MYSQL_ROOT_PASSWORD` no `.env`, ignorado pelo Git.
O banco é **MySQL 26.7.0**, com armazenamento persistente e porta local
`127.0.0.1:3307`. API e frontend são serviços separados. O navegador usa uma
única origem, com `/api` encaminhado para o Go.

### Desenvolvimento com hot reload

```bash
docker compose --env-file .env -f infra/compose.yaml -f infra/compose.dev.yaml --profile local-db up --build -d
```

Abra http://localhost:8080. Vite atualiza React/TypeScript no navegador; Air
recompila e reinicia a API ao alterar Go, SQL ou dependências. A API inicia
sem `app/dist`. Código é montado do checkout; dependências e binários ficam
em volumes próprios de desenvolvimento. O container frontend executa `npm ci`
ao iniciar, respeitando o lockfile. Após mudar dependências React, reinicie-o;
para atualizar Air/Go/Node ou Dockerfile, repita `up --build -d`.

Crie uma conta com um comando:

```bash
docker compose --env-file .env -f infra/compose.yaml -f infra/compose.dev.yaml exec api /src/api/bin/mtg4fun create-user --name rafa --password 'senha123'
```

### Produção com build

```bash
docker compose --env-file .env -f infra/compose.yaml --profile local-db up --build -d
```

O Docker compila Go e React. A API executa como usuário sem privilégios; Nginx
serve o cliente compilado e encaminha `/api`, preservando o host da origem.
Não há código montado nem Vite/Air neste modo. O MySQL continua sendo local;
este comando não conecta o banco de produção externo.

```bash
docker compose --env-file .env -f infra/compose.yaml exec api mtg4fun create-user --name rafa --password 'senha123'
```

Nos dois comandos de contas, `rafa` é o login e o nome exibido. Para um nome
diferente, use `--login rafa --name 'Rafa Silva'`. Senhas aceitam 8–72 bytes
UTF-8; login aceita 3–64 letras ASCII, números, ponto, hífen e sublinhado,
diferenciando maiúsculas. Nome tem até 100 caracteres. Duplicatas falham sem
substituir a conta. O [contrato de acesso](docs/decisions/01-acesso.md)
detalha autenticação e API.

### Operação e persistência

Em produção:

```bash
docker compose --env-file .env -f infra/compose.yaml --profile local-db ps
docker compose --env-file .env -f infra/compose.yaml --profile local-db logs -f api frontend mysql
docker compose --env-file .env -f infra/compose.yaml --profile local-db restart api frontend
docker compose --env-file .env -f infra/compose.yaml --profile local-db down
docker compose --env-file .env -f infra/compose.yaml --profile local-db up -d
```

Em desenvolvimento, acrescente `-f infra/compose.dev.yaml` após o arquivo base
em todos os comandos. Para alternar os modos, pare o modo atual com `down` e
inicie o outro com `up --build -d`. O projeto padrão é `mtg4fun`; ambos os
modos reutilizam o volume `mtg4fun_mysql-data` para contas e sessões.
`down` conserva os volumes; `down -v` os exclui e apaga os dados.
O volume SQLite antigo `mtg4fun_data`, quando existente, e os arquivos antigos
não são migrados nem excluídos. Contas antigas devem ser recriadas no MySQL,
conforme a [decisão aprovada](docs/decisions/19-20-mysql-e-docker.md).

Após alterações de código para produção, repita `up --build -d`. Para atualizar
imagens base, execute `build --pull` e depois `up -d`; para baixar novamente a
imagem de banco fixada, use `pull mysql`. Alterar senhas no `.env` não altera
usuários de um volume MySQL já inicializado: faça a rotação no banco também.

### Configuração e futuro banco externo

O Go lê variáveis de ambiente; o Compose lê o `.env` e fornece essas variáveis
à API. O executável não carrega `.env` diretamente. Senhas não são incorporadas
às imagens nem enviadas ao frontend.

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `DB_HOST` / `DB_PORT` | `mysql` / `3306` | Endereço acessado pela API. |
| `DB_NAME` / `DB_USER` | `mtg4fun` / `mtg4fun` | Banco e usuário da aplicação. |
| `DB_PASSWORD` | obrigatório | Senha da aplicação. |
| `MYSQL_ROOT_PASSWORD` | obrigatório para banco local | Senha administrativa do MySQL local. |
| `MYSQL_PORT` | `3307` | Porta do banco publicada somente em loopback no host. |
| `DB_TLS` | `false` | `true` exige TLS com validação do certificado do banco. |
| `DB_TLS_CA` | vazio | Arquivo PEM de CA própria, dentro do container; requer TLS. |
| `DB_CONNECT_TIMEOUT` | `120s` | Espera máxima inicial pelo banco; tentativas têm limites próprios. |
| `PORT` | `8080` | Porta HTTP publicada no host. |
| `BIND_ADDR` | `127.0.0.1` | Interface HTTP; `0.0.0.0` permite acesso pela rede. |
| `COOKIE_SECURE` | `false` | `true` em hospedagem HTTPS com proxy reverso. |

Para um banco externo futuro, configure `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD` e `DB_TLS=true` em um arquivo de ambiente próprio.
Inicie o Compose **sem `--profile local-db`**, para subir apenas API e frontend.
Nenhuma conexão externa foi configurada ou executada nesta entrega.
Se precisar de CA própria, monte o PEM como somente leitura em um override
Compose e indique seu caminho em `DB_TLS_CA`. A API cria as tabelas ausentes;
o usuário do banco precisa de permissões de criação e leitura/escrita nesse
banco. Ela não cria o banco externo nem importa dados SQLite.
O contrato antigo `--db`/`DB_PATH` foi removido; use as variáveis `DB_*`.

Para outro checkout/ambiente, use portas e projeto distintos:

```bash
PORT=8081 MYSQL_PORT=3308 docker compose --env-file .env -f infra/compose.yaml -f infra/compose.dev.yaml -p mtg4fun-outro --profile local-db up --build -d
```

Preserve `-p`, arquivos Compose e configuração ao operar esse ambiente, para
reutilizar os volumes corretos. A API não publica porta própria no host.
A primeira inicialização do MySQL pode levar alguns minutos; acompanhe os logs.

### Verificações

Com Go, Node, Python e Docker disponíveis para os testes:

```bash
go -C api vet ./...
go -C api test ./... -count=1
npm ci --prefix app
npm run build --prefix app
npm test --prefix app -- --workers=3
python3 infra/tests/docker_smoke.py
```

Os testes da API e do navegador iniciam MySQL 26.7.0 isolado e removem seus
containers ao terminar. A verificação Docker constrói os dois modos, exercita
login/recarga/logout no navegador, recria serviços conservando a sessão e
verifica hot reload de React e Go em cópias descartáveis dos fontes.
Use `--mode dev` ou `--mode prod` para verificar somente um modo.

## Organização do repositório

| Diretório | Conteúdo |
| --- | --- |
| `api/` | Backend Go, executável e testes de integração. |
| `app/` | Frontend React/TypeScript e testes de navegador. |
| `infra/` | Dockerfile, Compose e verificação Docker. |
| `docs/` | Especificações, issues e decisões. |
| `scripts/` | Ferramentas de desenvolvimento. |

As instruções para agentes estão no [AGENTS.md](AGENTS.md).
