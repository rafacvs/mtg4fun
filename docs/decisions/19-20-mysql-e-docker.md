# MySQL e modos Docker

Issues: [19](../issues/19-substituir-sqlite.md) e
[20](../issues/20-docker-dev-e-producao.md).

## Proposta e aprovação explícita

O usuário solicitou MySQL 26.7.0 local por Docker, publicado na porta 3307,
desenvolvimento com hot reload de Go e React e produção com builds dentro
do Docker. Pediu configuração preparada para um banco externo, sem conectar
o banco de produção nesta entrega.

Após investigação da implementação existente, foram propostas duas opções
para produção: manter Go servindo os arquivos do cliente ou separar API e
frontend. A recomendação foi separar MySQL, API Go e frontend Nginx em
produção; em desenvolvimento, MySQL, Go com Air e React com Vite.
Também foram propostos `database/sql` com `go-sql-driver/mysql`, variáveis de
ambiente fornecidas pelo Compose a partir de `.env`, configuração TLS e
publicação do banco somente em `127.0.0.1:3307`.

Para dados antigos, as alternativas apresentadas foram migração ou MySQL
vazio com recriação de contas, preservando arquivos e volumes SQLite antigos.
O usuário respondeu **“confirmo ambas”** às perguntas sobre a proposta de
serviços/configuração e o início com banco vazio. Foi explicitado em seguida
que essa autorização seria executada preservando o SQLite antigo.

Essa aprovação se aplica às issues 19 e 20. Não aprova conexão com produção,
exclusão dos dados antigos, nem novos comportamentos de autenticação.

## Fronteiras de validação

As fronteiras já confirmadas no [registro de acesso](01-acesso.md) são o
executável, a API HTTP com reinício e os fluxos reais de navegador. As issues
acrescentam verificação operacional Docker, durabilidade e hot reload.
Testes usam MySQL 26.7.0 real em containers com portas e dados isolados.

## Implementação

- `database/sql` e `go-sql-driver/mysql` 1.10.1 substituem SQLite e eliminam
  a necessidade de CGO. O esquema usa InnoDB, chaves estrangeiras e um índice
  de expiração. Login fica em `VARBINARY(64)` para preservar comparação exata
  por bytes, incluindo maiúsculas e rejeição de espaços extras.
- API lê `DB_*` do ambiente; Compose lê `.env`. A configuração não fica na
  imagem nem no cliente. TLS valida certificado e hostname; CA própria é
  opcional. O comando antigo `--db`/`DB_PATH` é substituído por `DB_*`.
- Produção compila API e cliente em estágios Docker próprios. Go executa sem
  privilégios, Nginx serve arquivos e encaminha `/api` preservando Host; DNS
  Docker é consultado novamente ao trocar o endereço da API.
- Desenvolvimento monta os fontes e isola módulos Go, cache de build,
  binários e dependências Node em volumes. Air 1.67.4 reinicia Go; Vite com
  `@vitejs/plugin-react` 6.1.2 oferece React Fast Refresh. A API não precisa de
  cliente compilado, mas preserva `--web` opcional para execução/testes locais.
- A API espera o banco com prazo configurável e tentativas com timeout. Erros
  SQL de conexão são reportados imediatamente. Compose reinicia a API de
  produção; Air reexecuta o processo de desenvolvimento se o banco demorar
  mais que a primeira espera. Não se presume prontidão por ordem de containers.
- MySQL local usa o perfil `local-db`, porta loopback 3307 e volume
  `mysql-data`. Sem o perfil, API/frontend podem usar banco externo configurado
  por ambiente. Nenhum endereço/credencial de produção foi configurado.
- SQLite não é aberto, migrado ou excluído. Os volumes/arquivos antigos
  permanecem disponíveis; o banco MySQL inicial é vazio e as contas são
  recriadas pelo comando com `--password`.

A verificação adicional de seis logins simultâneos encontrou um deadlock
MySQL (erro 1213) na limpeza de sessões expiradas seguida da inserção do token.
A transação de criação de sessão usa `READ COMMITTED` para não bloquear o
intervalo vazio de sessões durante inserções concorrentes. Esse detalhe local
preserva a atomicidade das gravações e os contratos de autenticação; não
altera o isolamento de futuras operações de salas/partidas. O teste reproduziu
o erro na versão anterior e a correção passou dez rodadas de seis logins,
seguida da suíte completa Go. As falhas reais de gravação continuam retornando
erro sem confirmar login ou logout.

Operação: [README](../../README.md#executar-com-docker).

## Validação concluída

- `go -C api vet ./...` e `go -C api test ./... -count=1`: passaram.
- `npm run typecheck --prefix app` e `npm run build --prefix app`: passaram.
- `npm test --prefix app -- --workers=3`: 9 cenários de acesso passaram;
  3 variantes do teste de hot reload foram omitidas por serem exclusivas de
  Docker dev. Desktop, celular vertical e horizontal foram exercitados.
- Compose dev/prod e configuração sem banco local: `config --quiet` passou.
- `python3 infra/tests/docker_smoke.py`: produção e desenvolvimento passaram
  em projetos, portas e volumes isolados. Cada modo passou 9 cenários de
  navegador, criação/duplicatas, login/logout e manutenção da conta e sessão
  após recriação de todos os serviços, incluindo MySQL com volume persistente.
  Desenvolvimento também passou o teste de hot reload de React sem trocar o
  documento e de Go com sessão preservada. A cópia descartável do backend dev
  recebeu a correção final de concorrência antes de executar esses cenários.
- `python3 infra/tests/docker_smoke.py --mode prod`: repetição com o backend
  final corrigido passou os mesmos cenários de navegador e durabilidade.
- Links locais, sintaxe Python e `git diff --check` conferidos.

Os testes do executável/navegador usam containers MySQL reais com diretório
temporário em tmpfs para acelerar a preparação. A durabilidade após recriação
do banco é verificada separadamente em volumes Docker persistentes.

## Revisão

Revisão de `b3d08b9` até `9ffd53f`, em worktrees independentes, com dois eixos
da skill `code-review`: Standards, 0 achados; Spec, 0 achados. Ambos os
revisores fizeram leitura estática, sem executar testes. A conclusão não
substitui os testes operacionais registrados acima.

Revisão complementar de `9ffd53f` até `d85858b` (correção de concorrência),
também em worktrees independentes: Standards, 0 achados; Spec, 0 achados.
Os revisores fizeram leitura estática; a suíte Go e os testes Docker foram
executados separadamente. As revisões verificam o código, sem substituir
a aprovação explícita da arquitetura registrada no início deste documento.

## Simplificação dos comandos Compose

Após a entrega, o usuário pediu comandos como `docker compose up -d api app`,
com `api` iniciando Go e MySQL e `app` representando React. Esse pedido autoriza
a simplificação operacional; a arquitetura aprovada de containers separados
é preservada.

O `.env.example` seleciona dev por `COMPOSE_FILE` e habilita `local-db` por
`COMPOSE_PROFILES`; Compose lê o `.env` automaticamente na raiz. Produção
seleciona somente o arquivo base no mesmo `.env`. Os arquivos Docker continuam
em `infra/`. O serviço frontend passa a se chamar `app`, dependente de `api`;
`api` depende de `mysql` quando o perfil local está ativo. A dependência é
opcional para conservar o modo externo sem subir MySQL local. Usa-se
`service_started`: a API continua responsável por esperar a prontidão do banco.

O comando de contas também é único nos dois modos:
`docker compose exec api mtg4fun create-user --name rafa --password 'senha123'`.
O diretório do binário Go no dev faz parte do PATH do container.

Verificação da simplificação: descoberta automática do `.env`, serviços,
targets dev/prod e configuração externa passaram via `docker compose config`.
`python3 infra/tests/docker_smoke.py --mode dev` passou: `api` iniciou apenas
Go/MySQL; `api app` iniciou a aplicação completa; criação e duplicata de contas,
9 cenários de navegador, hot reload React/Go e conta/sessão após recriação dos
serviços foram verificados.

A primeira rodada prod, executada em paralelo com dev, apresentou HTTP 500 em
cenários de navegador. A causa não foi confirmada nessa rodada. A repetição
separada de `python3 infra/tests/docker_smoke.py --mode prod` passou os mesmos
cenários de contas, 9 cenários de navegador e durabilidade, sem alterar Go ou
React. Durante essa repetição houve uma parada dos containers locais; retomou-se
somente o projeto isolado de teste, com as mesmas portas e o volume existente,
antes de concluir o fluxo. Os resultados anteriores acima são históricos.

Sintaxe Python, links locais e `git diff --check` passaram. Nenhum banco externo
foi conectado e nenhum volume de usuário foi alterado.
