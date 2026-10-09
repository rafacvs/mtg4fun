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

Há duas correções pendentes da primeira entrega:

- [Substituir SQLite](docs/issues/19-substituir-sqlite.md): o banco existente
  foi escolhido sem aprovação e rejeitado pelo usuário. O substituto ainda
  precisa ser definido.
- [Docker para desenvolvimento e produção](docs/issues/20-docker-dev-e-producao.md):
  hoje só existe uma imagem com frontend compilado. Falta um modo dev com
  hot reload em containers.

## Executar com Docker

Requisitos: Docker com Docker Compose. A partir da raiz do repositório:

```bash
docker compose -f infra/compose.yaml -p mtg4fun up --build -d
```

O Docker instala as dependências e compila Go e React dentro da imagem;
não é necessário executar builds manuais nem instalar Go ou Node no host.
O Compose atual tem um único serviço, `app`: o executável Go atende a API e
serve o React compilado. Este modo não oferece hot reload.

Abra http://localhost:8080 após criar uma conta. Para conferir a execução:

```bash
docker compose -f infra/compose.yaml -p mtg4fun ps
docker compose -f infra/compose.yaml -p mtg4fun logs -f app
```

### Criar uma conta

No Bash, leia a senha sem exibi-la nem colocá-la no histórico ou nos argumentos:

```bash
read -r -s -p 'Senha: ' account_password; echo
printf '%s' "$account_password" | docker compose -f infra/compose.yaml -p mtg4fun exec -T app mtg4fun create-user --login rafa --name 'Rafa' --password-stdin
unset account_password
```

Entre com o login e a senha criados. Senhas aceitam 8–72 bytes UTF-8; login
aceita 3–64 letras ASCII, números, ponto, hífen e sublinhado, diferenciando
maiúsculas. Nome é obrigatório, com até 100 caracteres. Login duplicado falha
sem substituir a conta. O [contrato de acesso](docs/decisions/01-acesso.md)
detalha autenticação e API.

### Parar, reiniciar e preservar dados

```bash
docker compose -f infra/compose.yaml -p mtg4fun restart app
docker compose -f infra/compose.yaml -p mtg4fun down
docker compose -f infra/compose.yaml -p mtg4fun up -d
```

Use o mesmo nome de projeto para reutilizar o volume `mtg4fun_data`, que
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
PORT=8081 docker compose -f infra/compose.yaml -p mtg4fun-outro up --build -d
```

Use esse mesmo projeto nos comandos de criação de contas e operação.

## Organização e desenvolvimento

| Diretório | Conteúdo |
| --- | --- |
| `api/` | Backend Go, executável e testes de integração. |
| `app/` | Frontend React/TypeScript e testes de navegador. |
| `infra/` | Dockerfile, Compose e verificação Docker. |
| `docs/` | Especificações, issues, decisões e guia de desenvolvimento. |
| `scripts/` | Ferramentas de desenvolvimento. |

O [guia de desenvolvimento](docs/desenvolvimento.md) reúne execução local,
hot reload com Vite e verificações. As instruções para agentes estão no
[AGENTS.md](AGENTS.md).
