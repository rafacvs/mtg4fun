# 16: Retomar partidas e transferir conexão de controle

**What to build:** Participantes retomam a mesma mesa após desconexão ou reinício; uma única conexão por conta mantém o controle.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Desconexão não apaga partida, cartas ou lugar e não impede os demais de continuar.
- [ ] Retorno de participante original envia visão autorizada atual, sem depender de mensagens perdidas.
- [ ] Usuário não participante não entra em jogo iniciado, mesmo se houver desconectados.
- [ ] Nova conexão autenticada assume controle; anterior informa transferência e servidor rejeita suas ações.
- [ ] Recuperar snapshot e log após encerrar/reiniciar servidor sem embaralhar ou sortear novamente.
- [ ] Presença e erros de reconexão têm apresentação PT-BR em desktop/celular.
- [ ] Testes com múltiplos clientes cobrem desconexão, todos offline, retomada, conexão antiga, privacidade e reinício real do serviço.
- [ ] Cada funcionalidade posterior continua responsável por incluir seu próprio estado na recuperação; este ticket não posterga durabilidade dos anteriores.

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
