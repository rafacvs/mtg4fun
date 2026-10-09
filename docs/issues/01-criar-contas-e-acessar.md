# 01: Criar contas e acessar a aplicação

**What to build:** O responsável cria contas pelo executável Go e os convidados acessam a aplicação pelo navegador, com execução local via Docker.

**Blocked by:** Correções nas issues [19](19-substituir-sqlite.md) e [20](20-docker-dev-e-producao.md) para concluir a entrega revisada; a implementação inicial não tinha dependências.

**Status:** corrections-pending

A funcionalidade de acesso foi implementada e teve verificações históricas
bem-sucedidas. A entrega tem correções pendentes: SQLite foi escolhido sem
aprovação e rejeitado pelo usuário ([issue 19](19-substituir-sqlite.md));
falta modo dev Docker com hot reload ([issue 20](20-docker-dev-e-producao.md)).
Os itens marcados abaixo descrevem o comportamento existente, não aprovação
de arquitetura nem conclusão dessas correções.

- [x] Aplicação Go e cliente React/TypeScript executam com Docker; instruções permitem iniciar o serviço e criar uma conta.
- [x] Comando recebe nome/login e senha e cria conta persistente com hash apropriado; senha não é armazenada em texto puro ou criptografia reversível.
- [x] Login válido dá acesso; credenciais inválidas e chamadas não autenticadas a recursos privados são recusadas pelo servidor.
- [x] Login e tela autenticada funcionam em desktop e celular, com interface PT-BR.
- [x] Conta permanece utilizável após reiniciar os serviços com armazenamento persistente.
- [x] Não oferecer cadastro público, administração web ou recuperação por e-mail.
- [ ] Obter aprovação explícita do usuário para o banco e decisões de segurança de grande impacto antes de implementar; registrar as escolhas. Há testes históricos de comando, autenticação e durabilidade, mas a escolha de SQLite foi rejeitada e precisa ser corrigida pela issue 19.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.

## Entrega e validação

Implementação e contrato em [decisões de acesso](../decisions/01-acesso.md);
instruções de operação e criação de contas no [README](../../README.md).
No registro histórico da implementação, testes do executável/API, fluxos
Playwright em desktop e celular e verificação Docker com recriação do serviço
e volume persistente passaram. A revisão desde `7dd2b1d` registrou ausência
de achados naquele momento. Esses resultados não constituem aprovação do
banco pelo usuário nem validação de um modo dev Docker, que ainda não existe.
A reestruturação documental não reexecuta essas verificações.
