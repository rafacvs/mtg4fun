# Acesso: armazenamento, credenciais e contrato

Issue: [01: Criar contas e acessar](../issues/01-criar-contas-e-acessar.md).

## Estado das decisões e pendências

Este documento descreve a implementação existente e suas verificações
históricas. A presença de uma escolha aqui não comprova aprovação do usuário.
SQLite foi escolhido sem consulta prévia e rejeitado como inviável para o
projeto. Sua substituição está na [issue 19](../issues/19-substituir-sqlite.md);
o banco substituto e o tratamento dos dados existentes aguardam aprovação.

O Docker atual executa somente backend e frontend compilado em um serviço.
O requisito de modos distintos, dev com hot reload e produção com build,
está na [issue 20](../issues/20-docker-dev-e-producao.md). A divisão final de
serviços ainda precisa de aprovação.

As demais escolhas técnicas abaixo descrevem o que existe; não recebem
aprovação retroativa por esta atualização. Novas decisões de grande impacto
seguem a [política do AGENTS.md](../../AGENTS.md#requisitos-e-decisões).
Resultados históricos de testes e revisões são preservados como registros
da entrega anterior; não foram reexecutados nesta atualização documental e
não encerram as pendências acima.

## Implementação existente

Um executável Go serve HTTP e os arquivos compilados do React/TypeScript com
Vite. SQLite (`database/sql` + `github.com/mattn/go-sqlite3`, com CGO) mantém
contas e sessões em um volume Docker, sem um serviço de banco adicional.
WAL, foreign keys, busy timeout e transações permitem criar contas pelo comando
enquanto o servidor está ativo. Esse banco não deve ser tratado como base
aprovada para funcionalidades futuras.

Bcrypt (`golang.org/x/crypto/bcrypt`) com custo 12 e salt aleatório guarda
senhas; aceitamos de 8 a 72 bytes UTF-8, rejeitando entradas maiores sem
truncamento. Login diferencia maiúsculas, tem 3–64 caracteres ASCII
(letras, números, ponto, hífen e sublinhado). Nome tem até 100 caracteres.
O comando aceita a senha diretamente em `--password`. Com `--name USUARIO`,
o mesmo valor é usado como login quando `--login` é omitido. `--password-stdin`
continua disponível para compatibilidade com o comando anterior. Contas duplicadas falham sem substituir a senha existente.

Sessões usam 32 bytes aleatórios; somente o SHA-256 do token fica no banco.
Cookie `mtg4fun_session`, HttpOnly, SameSite=Strict, Path=/, com validade de
24 horas. `COOKIE_SECURE=true` habilita Secure em hospedagem HTTPS. O servidor
não confia em cabeçalhos encaminhados para decidir esse atributo. Logout
revoga a sessão no banco antes de confirmar. A sessão sobrevive ao reinício,
até expirar. Tokens expirados são eliminados em logins posteriores.

## API HTTP, mesma origem

- `POST /api/session`: JSON `{ "login": "rafa", "password": "..." }`.
  200 com `{ "user": { "id": 1, "login": "rafa", "name": "Rafa" } }`
  e cookie; 401 para credenciais inválidas; 400 para corpo inválido.
- `GET /api/session`: recurso privado, retorna o mesmo JSON ou 401.
- `DELETE /api/session`: exige sessão, revoga token, limpa cookie e retorna 204.
- Erros: `{ "error": "mensagem em PT-BR" }`. Falhas de banco retornam 500;
  não confirmar gravações malsucedidas. APIs desconhecidas retornam 404.
- POST exige `application/json`, limite de corpo de 4 KiB. Métodos mutáveis
  rejeitam Origin de outro host/esquema e Sec-Fetch-Site cross-site (403),
  além do SameSite; não há CORS. Clientes sem Origin, como curl, são aceitos.
- Respostas da API são `Cache-Control: no-store`. Não enviar hash ou token
  em JSON nem registrar credenciais em logs.

Esta entrega não inclui recursos de salas, decks ou partidas. O controle de
uma conexão ativa e sua transferência pertencem à issue 16; sessão de acesso
não representa conexão de jogo. Não há cadastro público, administração web ou
recuperação por e-mail.

## Verificação

Testes do executável e API usam processos e SQLite reais, incluindo reinício,
credenciais inválidas, duplicatas, logout e acesso privado. Playwright exercita
login, recarga e saída com desktop e celular. A leitura dos arquivos duráveis
é uma auditoria adicional para detectar senha em texto puro, não um teste de
organização de tabelas.

As fronteiras de teste foram confirmadas pelo usuário: executável, API HTTP
com reinício e fluxo de navegador. A implementação inicial precedeu essa
confirmação; os testes seguintes reproduziram e corrigiram o conflito de
registro de rotas do servidor e a saída de uma sessão já revogada no cliente.

## Validação histórica da entrega

- `go -C api vet ./...` e `go -C api test ./... -count=1`: passaram.
- `npm run build --prefix app` e `npm run typecheck --prefix app`: passaram.
- `npm test --prefix app -- --workers=3`: 9 cenários passaram, em desktop,
  celular vertical e celular horizontal, incluindo credenciais inválidas,
  recarga com sessão e logout. Capturas conferidas; sem overflow horizontal.
- `python3 infra/tests/docker_smoke.py`: passou com imagem compilada, comando de
  criação de conta, autenticação, logout e recriação do serviço mantendo
  conta e sessão no volume. Projeto, porta e volume de teste isolados e
  removidos ao terminar.

## Revisão histórica de padrões

Nenhum achado na revisão desde `7dd2b1d`: sem violações documentadas ou smells
concretos. A implementação mantém poucas camadas e dependências, documenta
escolhas e contrato, testa comportamentos públicos e isola bancos e serviços
de teste. Revisão por leitura em worktree própria.

## Revisão histórica de escopo

A revisão anterior registrou ausência de achados de requisitos ou comportamento
para a issue 01. Essa conclusão antecede as correções exigidas pelo usuário.
A revisão considerou contas pelo executável, bcrypt, API privada, interface
PT-BR responsiva, persistência, Docker, documentação e testes.
Transferência de conexão permanece na issue 16. Revisão por leitura em worktree
própria; verificação operacional Docker confirmada após a revisão.

Resultado histórico registrado: Standards 0 achados; Spec 0 achados.
Não representa a situação atual de aprovação do banco ou do ambiente dev.

## Organização do código

A organização aprovada separa `api/` (Go), `app/` (React/TypeScript) e `infra/`
(Docker). Os módulos são agrupados por funcionalidade, com responsabilidades
compartilhadas explícitas. O [mapa no README](../../README.md#organização-do-repositório)
resume os diretórios; o [AGENTS.md](../../AGENTS.md) registra as regras.

O módulo `auth` recebe a conexão aberta por `database`; o esquema existente é
embutido no executável a partir de `schema.sql`, sem mudança de tabelas ou
migração de dados. `httpserver` recebe o handler de autenticação, aplica
proteções compartilhadas e serve o frontend compilado. No cliente, as telas,
o estado de autenticação, o contrato HTTP e os estilos têm arquivos próprios.

Os endpoints e suas mensagens, cookies, hash de senhas e transações permanecem iguais.
O desenvolvimento local do backend passa a usar `api/` como diretório de
trabalho e `../app/dist` como cliente compilado. Docker mantém serviço `app`,
volume `data` e os caminhos de armazenamento, usando o mesmo nome de projeto.

## Validação histórica da reorganização

Os comandos de validação acima foram executados novamente com os novos caminhos:
Go, build e tipos do cliente, os 9 cenários de navegador e o teste Docker passaram.
As capturas de desktop e celular mantêm a aparência anterior. O servidor também
foi iniciado a partir de `api/` usando o caminho padrão `../app/dist`.

Uma verificação adicional criou conta e sessão com o executável anterior e
abriu o mesmo banco com o reorganizado: a sessão existente e um novo login
funcionaram, sem migração ou alteração das credenciais.

Standards: 0 achados na revisão das regras documentadas e organização final.
Spec: 0 achados na revisão da issue 01 e do plano de reorganização aprovado.
As revisões desde `7dd2b1d` foram realizadas por leitura em worktrees separadas;
a execução dos testes e a persistência do volume Docker foram verificadas no
checkout da tarefa.

## Simplificação do comando de contas

O usuário solicitou explicitamente um único comando com nome e senha em
argumentos, dispensando a leitura oculta no terminal. A opção `--password`
atende essa solicitação; `--login` só é necessário para diferenciar o login
do nome exibido. O Compose define `mtg4fun` como projeto padrão, preservando
o volume existente e dispensando `-p` nos comandos do ambiente principal.

Exemplo executado em `infra/`:

```bash
docker compose exec app mtg4fun create-user --name rafa --password 'senha123'
```
