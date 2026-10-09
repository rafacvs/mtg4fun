# 01: Criar contas e acessar a aplicação

**What to build:** O responsável cria contas pelo executável Go e os convidados acessam a aplicação pelo navegador, com execução local via Docker.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Aplicação Go e cliente React/TypeScript executam com Docker; instruções permitem iniciar o serviço e criar uma conta.
- [ ] Comando recebe nome/login e senha e cria conta persistente com hash apropriado; senha não é armazenada em texto puro ou criptografia reversível.
- [ ] Login válido dá acesso; credenciais inválidas e chamadas não autenticadas a recursos privados são recusadas pelo servidor.
- [ ] Login e tela autenticada funcionam em desktop e celular, com interface PT-BR.
- [ ] Conta permanece utilizável após reiniciar os serviços com armazenamento persistente.
- [ ] Não oferecer cadastro público, administração web ou recuperação por e-mail.
- [ ] Escolher e documentar banco e algoritmo de hash com simplicidade; testes observáveis cobrem comando, autenticação e durabilidade.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
