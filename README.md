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

Requisitos: Docker com Docker Compose. Entre em `infra/` a partir da raiz;
os comandos Docker abaixo são executados nesse diretório:

```bash
cd infra
docker compose up --build -d
```

O Docker instala as dependências e compila Go e React dentro da imagem;
não é necessário executar builds manuais nem instalar Go ou Node no host.
O Compose atual tem um único serviço, `app`: o executável Go atende a API e
serve o React compilado. Este modo não oferece hot reload.

Abra http://localhost:8080 após criar uma conta. Para conferir a execução:

```bash
docker compose ps
docker compose logs -f app
```

### Criar uma conta

Crie a conta com um comando, informando usuário e senha:

```bash
docker compose exec app mtg4fun create-user --name rafa --password 'senha123'
```

Nesse exemplo, `rafa` é o login e o nome exibido. Para um nome diferente do login,
acrescente `--login`, por exemplo `--login rafa --name 'Rafa Silva'`.
O login na aplicação é feito pelo navegador.

Entre com o login e a senha criados. Senhas aceitam 8–72 bytes UTF-8; login
aceita 3–64 letras ASCII, números, ponto, hífen e sublinhado, diferenciando
maiúsculas. Nome é obrigatório, com até 100 caracteres. Login duplicado falha
sem substituir a conta. O [contrato de acesso](docs/decisions/01-acesso.md)
detalha autenticação e API.

### Parar, reiniciar e preservar dados

```bash
docker compose restart app
docker compose down
docker compose up -d
```

O projeto padrão `mtg4fun` usa o volume `mtg4fun_data`, que
conserva contas e sessões. `down -v` exclui esse volume e seus dados.
Após alterações no código, execute novamente `up --build -d` para atualizar a imagem.

### Configuração

| Variável do Compose | Padrão | Finalidade |
| --- | --- | --- |
| `PORT` | `8080` | Porta publicada no host. |
| `BIND_ADDR` | `127.0.0.1` | Interface do host; `0.0.0.0` permite acesso pela rede. |
| `COOKIE_SECURE` | `false` | Use `true` em hospedagem HTTPS com proxy reverso. |

O cliente e a API devem ser acessados pela mesma origem. Para executar outro
ambiente sem compartilhar porta ou dados:

```bash
PORT=8081 docker compose -p mtg4fun-outro up --build -d
```

Use esse mesmo projeto nos comandos de criação de contas e operação.

## Organização do repositório

| Diretório | Conteúdo |
| --- | --- |
| `api/` | Backend Go, executável e testes de integração. |
| `app/` | Frontend React/TypeScript e testes de navegador. |
| `infra/` | Dockerfile, Compose e verificação Docker. |
| `docs/` | Especificações, issues e decisões. |
| `scripts/` | Ferramentas de desenvolvimento. |

As instruções para agentes estão no [AGENTS.md](AGENTS.md).
