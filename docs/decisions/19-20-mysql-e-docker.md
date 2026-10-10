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

Operação: [README](../../README.md#executar-com-docker).

## Validação em andamento

- `go -C api vet ./...` e `go -C api test ./... -count=1`: passaram.
- `npm run typecheck --prefix app` e `npm run build --prefix app`: passaram.
- `npm test --prefix app -- --workers=3`: 9 cenários de acesso passaram;
  3 variantes do teste de hot reload foram omitidas por serem exclusivas de
  Docker dev. Desktop, celular vertical e horizontal foram exercitados.
- Compose dev/prod e configuração sem banco local: `config --quiet` passou.
- Links locais e sintaxe Python conferidos. Verificação Docker dos dois modos
  em andamento; não é apresentada como concluída neste registro.

Os testes do executável/navegador usam containers MySQL reais com diretório
temporário em tmpfs para acelerar a preparação. A durabilidade após recriação
do banco é verificada separadamente em volumes Docker persistentes.
