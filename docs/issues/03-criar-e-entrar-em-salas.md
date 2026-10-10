# 03: Criar e entrar em salas

**What to build:** Usuários autenticados encontram, criam e entram em salas disponíveis, acompanhando seus participantes em tempo real.

**Blocked by:** 01: Criar contas e acessar a aplicação.

**Status:** ready-for-agent

- [ ] Listar e criar salas; qualquer usuário autenticado entra em sala com vaga sem aprovação extra.
- [ ] Limite de seis participantes é aplicado pelo servidor, inclusive quando entradas concorrem pela última vaga.
- [ ] Participantes e vagas atualizam nos clientes conectados sem recarregar a página.
- [ ] Várias salas coexistem sem compartilhar participantes ou alterações indevidamente.
- [ ] Salas e participação são persistentes; conexão temporária não define a existência da sala.
- [ ] Telas e erros em PT-BR funcionam com mouse e toque.
- [ ] Testes com múltiplos clientes cobrem limite, entrada concorrente, isolamento e chamadas não autenticadas.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.

## Decisão relacionada

A [decisão SSE para salas](../decisions/03-salas-sse.md) registra a aprovação e
a auditoria de impacto. Seu escopo é listar/criar/entrar e atualizar participantes;
transporte e contratos de partida, prontidão e controle de conexão permanecem
fora dessa escolha. Os critérios desta issue permanecem vigentes.
