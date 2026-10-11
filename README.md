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
A biblioteca pessoal importa, consulta e exclui decks .cod, resolvidos pelo
catálogo Cockatrice compartilhado no servidor. Usuários autenticados criam e
entram em salas persistentes de até seis participantes, com atualizações em
tempo real. O lobby lista salas; **Entrar na mesa** abre a URL da sala
(`/#/salas/{id}`), com preparação dos decks e início pelo criador após todos
confirmarem prontidão.

A mesa permite comprar cartas e movê-las entre mão, campo, cemitério, exílio,
comando e topo/fundo do grimório, com estado e log persistidos. Clique/toque
numa carta e escolha o destino na faixa inferior. A mão própria permanece
disponível ao observar oponentes; desktop oferece visão conjunta/ampliação e
celular usa orientação horizontal e miniaturas à direita. A partida atualiza
a cada segundo. Arraste/posicionamento, seleção múltipla e as demais ações das
specs ainda têm entregas próprias pendentes.

## Executar com Docker

Requisitos: Docker com Docker Compose 2.20 ou mais recente. Execute os comandos
a partir da raiz.
Go, Node e MySQL são instalados dentro das imagens, sem builds manuais no host.

Copie a configuração e defina senhas locais diferentes para a aplicação e root:

```bash
cp .env.example .env
```

Edite `DB_PASSWORD` e `MYSQL_ROOT_PASSWORD` no `.env`, ignorado pelo Git.
Se já tem `.env`, preserve suas credenciais e acrescente `COMPOSE_FILE` e
`COMPOSE_PROFILES` conforme o exemplo. Ao atualizar da configuração anterior
(serviço `frontend`), use `docker compose down --remove-orphans` uma vez para
remover os containers antigos, preservando os volumes.
O `.env` também seleciona o modo: o exemplo já vem configurado para dev.
O Compose lê essa configuração automaticamente na raiz, sem `-f` ou
`--profile` nos comandos. Os serviços são `api` (Go, que inicia seu MySQL
local como dependência) e `app` (React, que também inicia a API).

O banco é **MySQL 26.7.0**, com armazenamento persistente e porta local
`127.0.0.1:3307`. API e frontend são serviços separados. O navegador usa uma
única origem, com `/api` encaminhado para o Go.

### Desenvolvimento com hot reload

```bash
docker compose up -d api app
```

O primeiro `up` constrói as imagens automaticamente. Para subir somente o
backend e o banco, use `docker compose up -d api`; para subir a aplicação
completa, também pode usar `docker compose up -d app`.

Abra http://localhost:8080. Vite atualiza React/TypeScript no navegador; Air
recompila e reinicia a API ao alterar Go, SQL ou dependências. A API inicia
sem `app/dist`. Código é montado do checkout; dependências e binários ficam
em volumes próprios de desenvolvimento. O serviço `app` executa `npm ci`
ao iniciar, respeitando o lockfile. Após mudar dependências React, reinicie-o;
para atualizar Air/Go/Node ou Dockerfile, repita `docker compose up --build -d api app`.

### Produção com build

No `.env`, troque a seleção de arquivos para:

```dotenv
COMPOSE_FILE=infra/compose.yaml
```

Depois use os mesmos nomes de serviços:

```bash
docker compose up --build -d api app
```

O Docker compila Go e React. A API executa como usuário sem privilégios; Nginx
serve o cliente compilado e encaminha `/api`, preservando o host da origem.
Não há código montado nem Vite/Air neste modo. O MySQL continua sendo local;
este comando não conecta o banco de produção externo.

### Criar conta em qualquer modo

```bash
docker compose exec api mtg4fun create-user --name rafa --password 'senha123'
```

No comando de contas, `rafa` é o login e o nome exibido. Para um nome
diferente, use `--login rafa --name 'Rafa Silva'`. Senhas aceitam 8–72 bytes
UTF-8; login aceita 3–64 letras ASCII, números, ponto, hífen e sublinhado,
diferenciando maiúsculas. Nome tem até 100 caracteres. Duplicatas falham sem
substituir a conta. O [contrato de acesso](docs/decisions/01-acesso.md)
detalha autenticação e API.

### Operação e persistência

Em produção:

```bash
docker compose ps
docker compose logs -f api app mysql
docker compose restart api app
docker compose down
docker compose up -d api app
```

Os comandos são iguais nos dois modos. Para alternar, use `docker compose down`
antes de editar `COMPOSE_FILE` no `.env`, e então `docker compose up --build -d api app`.
Para voltar ao dev, use `COMPOSE_FILE=infra/compose.yaml:infra/compose.dev.yaml`.
O projeto padrão é `mtg4fun`; ambos os modos reutilizam o volume `mtg4fun_mysql-data` para contas e sessões.
`down` conserva os volumes; `down -v` os exclui e apaga os dados.
O volume SQLite antigo `mtg4fun_data`, quando existente, e os arquivos antigos
não são migrados nem excluídos. Contas antigas devem ser recriadas no MySQL,
conforme a [decisão aprovada](docs/decisions/19-20-mysql-e-docker.md).

Após alterações de código para produção, repita `docker compose up --build -d api app`.
Para atualizar imagens base, execute `docker compose build --pull` e depois
`docker compose up -d api app`; para baixar novamente a imagem de banco fixada,
use `docker compose pull mysql`. Alterar senhas no `.env` não altera
usuários de um volume MySQL já inicializado: faça a rotação no banco também.

### Configuração e futuro banco externo

O Go lê variáveis de ambiente; o Compose lê o `.env` e fornece essas variáveis
à API. O executável não carrega `.env` diretamente. Senhas não são incorporadas
às imagens nem enviadas ao frontend.

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `COMPOSE_FILE` | `infra/compose.yaml:infra/compose.dev.yaml` | Modo dev; use somente `infra/compose.yaml` para produção. |
| `COMPOSE_PROFILES` | `local-db` | Habilita MySQL local; vazio para banco externo. |
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
Esvazie `COMPOSE_PROFILES=` no arquivo de ambiente para desabilitar o MySQL
local. `docker compose up -d api app` sobe então somente API e frontend.
A dependência local da API é opcional para permitir esse modo externo.
Nenhuma conexão externa foi configurada ou executada nesta entrega.
Se precisar de CA própria, monte o PEM como somente leitura em um override
Compose e indique seu caminho em `DB_TLS_CA`. A API cria as tabelas ausentes;
o usuário do banco precisa de permissões de criação e leitura/escrita nesse
banco. Ela não cria o banco externo nem importa dados SQLite.
O contrato antigo `--db`/`DB_PATH` foi removido; use as variáveis `DB_*`.

Para outro checkout/ambiente, use portas e projeto distintos:

```bash
PORT=8081 MYSQL_PORT=3308 docker compose -p mtg4fun-outro up -d api app
```

Preserve `-p` e o `.env` ao operar esse ambiente, para
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

## Decks e catálogo Cockatrice

A biblioteca pessoal permite importar, escolher, consultar e excluir decks `.cod`
em computador e celular. O arquivo deve ter até 2 MiB; usa-se somente a seção
`main` (incluindo categorias). Sideboard e outras seções são ignorados. As cartas
precisam existir no catálogo compartilhado. Não há edição ou exportação de decks.

O repositório inclui o catálogo em `api/catalog/`: `cards.xml` gerado pelo Oracle
do Cockatrice a partir do MTGJSON AllPrintings e `tokens.xml` do
[Magic-Token](https://github.com/Cockatrice/Magic-Token), no formato
`cockatrice_carddatabase`. O servidor carrega os dois arquivos na memória ao
iniciar; não há etapa de importação. A imagem de produção já contém os arquivos.
Fora do Docker, `serve` procura `catalog/cards.xml` e `catalog/tokens.xml`
relativos ao diretório atual (por exemplo, `go -C api run ./cmd/mtg4fun serve`);
outros caminhos podem ser informados com `--cards`/`--tokens` ou
`CATALOG_CARDS`/`CATALOG_TOKENS`. Catálogo ausente ou inválido impede o início.

Para atualizar o catálogo, execute o Oracle do Cockatrice, substitua os dois
arquivos em `api/catalog/` pelos gerados (`~/.local/share/Cockatrice/Cockatrice/`
no Linux) e reinicie a API; em desenvolvimento, o Air reinicia sozinho. Em
produção, reconstrua a imagem da API.

Decks guardam apenas nomes e quantidades e são resolvidos contra o catálogo atual
a cada listagem. Atualizações não exigem novo upload. Cartas removidas de um
dataset permanecem nos decks, identificadas como indisponíveis. O navegador não
configura nem baixa datasets. Ao consultar uma carta, mostra seu texto e pede uma
imagem ampliada à API. A API baixa sob demanda do Scryfall conforme os
identificadores Cockatrice e guarda um cache compartilhado persistente entre
usuários e reinícios; falha de imagem não impede a leitura do texto. Não há
download antecipado das imagens. Detalhes e autorização: [decisão de
imagens](docs/decisions/04-imagens-compartilhadas.md). A preparação da partida
ainda é uma entrega posterior.

A API autenticada oferece `GET /api/decks` (biblioteca com cartas/quantidades),
`POST /api/decks` (multipart, campo `file`, retorno `deck`) e
`DELETE /api/decks/{id}`. Bibliotecas de outras contas não são expostas.
Detalhes: [decisão de decks/catálogo](docs/decisions/02-decks-e-catalogo.md).

## Salas

Após entrar, qualquer usuário cria uma sala ou entra em uma sala em preparação
com vaga. O criador ocupa a primeira das seis vagas; participantes e vagas são
atualizados sem recarregar, em computador ou celular vertical/horizontal.
A participação permanece após saída da aplicação e reinício do servidor.
Ainda não há preparação de decks, prontidão ou início de partidas nesta entrega.

A API oferece `GET /api/rooms`, `POST /api/rooms` e
`POST /api/rooms/{id}/participants` (ações com JSON `{}`). Atualizações usam
`GET /api/rooms/events` por SSE, com sessão existente e snapshot inicial após
reconexão. O Nginx de produção está configurado para streaming sem buffering.
Contrato, aprovação e impactos futuros: [decisão de salas/SSE](docs/decisions/03-salas-sse.md).
