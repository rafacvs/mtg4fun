# Migrations MySQL e bancos isolados por worktree

## Proposta e aprovação

Após examinar o esquema atual, foi proposto usar `goose` com migrations SQL
versionadas e embutidas no executável Go. O usuário pediu a implementação
antes de criar o banco/VPS de produção e autorizou preservar o MySQL local
existente com backup verificado. Escolheu aplicação explícita de migrations
em produção e automática em desenvolvimento.

O usuário também exigiu que migrations de uma worktree não afetem o banco
principal e aprovou uma cópia isolada dos dados para cada worktree, criada
automaticamente por `worktree.sh create`. As cópias são snapshots; alterações
posteriores não são sincronizadas. Dados SQLite antigos não precisam ser
preservados ou importados nesta entrega. Essa aprovação não autoriza conectar
ou alterar uma futura instância de produção.

## Implementação

- `00001_initial.sql` representa o esquema MySQL anterior. O goose registra
  versões em `goose_db_version`; o comando `migrate up` aplica migrations e
  `migrate status` mostra seu estado.
- A API exige a versão esperada antes de atender requisições ou criar contas.
  Em dev, Air executa `migrate up` antes de `serve`. Em produção, a migration
  é um passo explícito do deploy; a API não altera o esquema ao iniciar.
- Cada worktree usa `COMPOSE_PROJECT_NAME` e portas próprias. O script de
  criação copia a configuração local e importa um dump consistente do MySQL
  principal em um volume novo. Reabrir a worktree reutiliza esse volume.
- Antes de alterar o MySQL local, foi criado o dump
  `pre-goose-20261011T135428Z.sql` fora do repositório. SHA-256:
  `08136f6dcaf65d0ed20716e5a2f17e9ce5e22323639f2b723f8d74bacc669a3b`.
  A restauração em MySQL descartável reproduziu as contagens das dez tabelas
  existentes. O volume principal não foi apagado nem reimportado.

Como DDL do MySQL faz commit implícito, migrations estruturais usam a anotação
`NO TRANSACTION`. Mudanças futuras devem ser pequenas e acompanhadas de
backup e ensaio de restauração antes de serem aplicadas em produção.
