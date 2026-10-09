# Acesso: armazenamento, credenciais e contrato

Issue: `docs/issues/01-criar-contas-e-acessar.md`.

Um executável Go serve HTTP e os arquivos compilados do React/TypeScript com
Vite. SQLite (`database/sql` + `github.com/mattn/go-sqlite3`, com CGO) mantém
contas e sessões em um volume Docker, sem um serviço de banco adicional.
WAL, foreign keys, busy timeout e transações permitem criar contas pelo comando
enquanto o servidor está ativo. Futuras tabelas podem usar o mesmo banco.

Bcrypt (`golang.org/x/crypto/bcrypt`) com custo 12 e salt aleatório guarda
senhas; aceitamos de 8 a 72 bytes UTF-8, rejeitando entradas maiores sem
truncamento. Login diferencia maiúsculas, tem 3–64 caracteres ASCII
(letras, números, ponto, hífen e sublinhado). Nome tem até 100 caracteres.
O comando recebe a senha por stdin, para não colocá-la nos argumentos ou
histórico do shell. Contas duplicadas falham sem substituir a senha existente.

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
