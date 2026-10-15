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
a cada segundo. A seleção múltipla no campo e as demais ações das
specs ainda têm entregas próprias pendentes.

O menu do grimório oferece comprar, embaralhar diretamente, olhar cartas do
topo/fundo em privado, buscar no grimório inteiro e revelar cartas. Durante
a consulta, clique na linha para selecionar cartas para mover ou revelar,
na imagem para ampliá-la e arraste pela alça à esquerda para reordenar.
Devolva as restantes ao topo/fundo na ordem exibida, com ou sem
embaralhamento explícito. Fechar o painel mantém a consulta em andamento para
retomar, inclusive após recarregar a página. As cartas reveladas aparecem para
todos até ocultar sua revelação explicitamente, inclusive após mover/devolver;
as demais continuam privadas. Passar o turno oculta todas as revelações sem
mover as cartas. Na zona Reveladas, **Ocultar todas reveladas** limpa as suas.
Abrir uma imagem é uma visualização local; fechar o detalhe oculta a carta,
salvo se marcar **Manter revelada ao fechar**. Essas operações não interpretam
texto de cartas.

Clique/toque na carta abre controles de virar/desvirar no campo, face para
baixo/cima, escolha entre faces preservadas do catálogo e revelar/ocultar.
Duplo clique no próprio campo vira/desvira; **Desvirar todas** fica no menu
**Ações**. Escolher um lado da carta e colocá-la face para baixo são estados
independentes. Ao sair do campo para cemitério/exílio, a carta perde marcadores, modificadores
de poder/resistência, virado e face para baixo. A face escolhida permanece.

Em **Ações**, a grade abre uma tela para vida, marcadores, compra e dado.
**Vida** altera o total do próprio jogador. **Marcadores** usa cinco cores
neutras, sem significado de regra. Na carta, poder e resistência ficam no
diálogo da imagem, e as cores abrem em seguida. Valores negativos são aceitos
sem interpretar derrota. Vida e marcadores do jogador são públicos;
modificador e marcador de carta na mão não aparecem para o oponente. Digite um
inteiro e confirme com Enter, ou use os botões −/+ para alterar uma unidade.
Valores
e registro persistem após reinício. Veja a
[semântica de vida e marcadores](docs/decisions/12-vida-e-contadores.md).

Em **Ações → Criar ficha**, busque uma ficha do catálogo compartilhado ou
preencha nome, descrição e poder/resistência numéricos, inclusive negativos.
Fichas personalizadas usam uma imagem padrão. Clique/toque em uma carta
identificada e escolha **Criar cópia independente**: a nova instância entra no
seu campo e não acompanha alterações posteriores no original. Fichas e cópias
são removidas do jogo ao mover para qualquer zona fora do campo. Atributos copiados
e contrato: [decisão de fichas/cópias](docs/decisions/13-fichas-e-copias.md).

A barra junto da mão oferece comprar uma carta, passar turno e desvirar todas.
Atalhos: **D** comprar, **U** desvirar todas, **N** passar turno e **H** ocultar
as próprias reveladas. Não atuam durante digitação, com modificadores ou com
um diálogo aberto. Duplo clique no grimório compra uma carta; clique abre suas
ações. As linhas do campo aceitam agrupamento manual de até três cartas, com
espaço para cartas viradas e scroll horizontal. **Jogadores / Registro** abre
ou recolhe a coluna lateral; ela começa recolhida em telas menores.
Na lateral direita, acima dos jogadores/registro, passar o mouse sobre uma
carta mostra sua prévia ampliada. **Ocultar prévia / Mostrar prévia** controla
essa seção; **Recolher registro** recolhe toda a lateral, incluindo a prévia.
Veja os [ajustes de regras e interface](docs/decisions/22-ajustes-da-mesa.md).

**Finalizar**, em vermelho à direita de **Ocultar prévia**, abre a confirmação
de encerramento. Qualquer jogador pode concordar; pelo menos metade dos
participantes, arredondando para cima, encerra a partida e fecha a sala para
todos. Sozinho, basta confirmar. Enquanto faltam concordâncias, a mesa continua
jogável e os votos ficam salvos. Ao encerrar, todos voltam ao lobby e a sala
sai da lista; estado final e registro são preservados. Veja a
[decisão de encerramento](docs/decisions/24-finalizar-partida.md).
O grimório usa o verso de carta fornecido na revisão visual, com efeito de pilha.

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
Em desenvolvimento, o Air aplica migrations pendentes antes de iniciar a API.
Se uma migration falhar, consulte `docker compose logs api`; corrija-a e salve
o arquivo para que o Air tente novamente. Consulte o estado com
`docker compose exec api mtg4fun migrate status`.

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

Em um banco novo, aplique as migrations antes de iniciar a API:

```bash
docker compose run --build --rm api migrate up
docker compose up --build -d api app
```

Em atualizações com dados, faça backup e siga esta sequência:

```bash
docker compose stop app api
docker compose build api app
docker compose run --rm api migrate up
docker compose up -d api app
```

A API recusa iniciar se a versão do banco não corresponder às migrations
embutidas. Consulte o histórico com `docker compose run --rm api migrate status`.
O [registro da decisão](docs/decisions/21-migrations-e-worktrees.md) descreve
a adoção do esquema existente.

O Docker compila Go e React. A API executa como usuário sem privilégios; Nginx
serve o cliente compilado e encaminha `/api`, preservando o host da origem.
Não há código montado nem Vite/Air neste modo. Com `local-db`, o MySQL é local;
a conexão externa só ocorre se `COMPOSE_PROFILES` e `DB_*` forem configurados
para ela.

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

Após alterações de código sem migrations, repita `docker compose up --build -d api app`.
Para um backup lógico do MySQL local, com arquivo protegido fora do repositório:

```bash
umask 077
mkdir -p "$HOME/mtg4fun-backups"
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --quick --set-gtid-purged=OFF --routines --triggers --events -u root "$MYSQL_DATABASE"' > "$HOME/mtg4fun-backups/backup-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

Confirme que o arquivo não está vazio e teste sua restauração em um banco
descartável antes de alterar o banco original. Guarde o backup em local seguro.
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
| `COMPOSE_PROJECT_NAME` | `mtg4fun` | Nome do projeto e prefixo dos volumes; cada worktree usa um nome próprio. |
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
Compose e indique seu caminho em `DB_TLS_CA`. Crie o banco externo e execute
`migrate up` com uma conta que possa alterar o esquema. A API em execução só
precisa de leitura e escrita nos dados; se usar uma conta separada para ela,
forneça as credenciais de migration por um arquivo de ambiente próprio ao
executar o comando. A API não cria o banco externo.
O contrato antigo `--db`/`DB_PATH` foi removido; use as variáveis `DB_*`.

Para criar uma worktree com uma cópia isolada dos dados locais:

```bash
./scripts/worktree.sh create nome-da-tarefa master
cd ../mtg4fun-worktrees/nome-da-tarefa
docker compose up -d api app
```

O script copia a configuração do `.env` principal, define projeto e porta HTTP
exclusivos e cria o banco `mtg4fun_<nome>` no MySQL que já está em execução.
Não sobe outro servidor. O MySQL principal precisa estar no ar. Não substitua
o `.env` gerado pelo `.env` principal: isso apontaria a worktree para o banco
da raiz. Mudanças feitas depois na cópia não se sincronizam.
`./scripts/worktree.sh isolate <nome>` prepara worktrees existentes; ao
reabri-las, o script preserva o banco próprio. A API não publica porta própria
no host. A API da worktree entra na rede `mtg4fun-db` e fala com o alias
`mtg4fun-mysql`.

### Verificações

Com Go, Node, Python e Docker disponíveis para os testes:

```bash
go -C api vet ./...
go -C api test ./... -count=1
npm ci --prefix app
npm run build --prefix app
npm run test:unit --prefix app
npm test --prefix app -- --workers=3
python3 infra/tests/docker_smoke.py
```

Os testes da API e do navegador iniciam MySQL 26.7.0 isolado e removem seus
containers ao terminar. A verificação Docker constrói os dois modos, exercita
login/recarga/logout no navegador, recria serviços conservando a sessão e
verifica hot reload de React e Go em cópias descartáveis dos fontes.
Use `--mode dev` ou `--mode prod` para verificar somente um modo.

Para validar visualmente pilhas de duas/três cartas, pilhas mistas com cartas
viradas, linhas e overflow, execute:

```bash
npm test --prefix app -- ajustes-mesa.spec.ts --workers=2
```

Esse fluxo cria os cenários pela API real em banco descartável e gera
`campo-cenarios.png` e `painel-carta.png` nos relatórios de `app/test-results/`.
Não altera as mesas em execução no Docker local.

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
