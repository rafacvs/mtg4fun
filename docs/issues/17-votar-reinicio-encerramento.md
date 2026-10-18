# 17: Votar pelo reinício ou encerramento

**What to build:** Qualquer participante propõe reiniciar (unanimidade) ou finalizar (pelo menos metade da sala), preservando votos e estado mesmo com desconexões.

**Blocked by:** 16: Retomar partidas e transferir conexão de controle.

**Status:** ready-for-agent

Entrega parcial: encerramento pelo botão **Finalizar**, autorizado na
[decisão de encerramento](../decisions/24-finalizar-partida.md). A exigência
de unanimidade foi substituída por metade da sala somente para finalizar;
reinício, recusa/cancelamento de propostas de reinício e controle exclusivo
de conexão continuam pendentes. Não considerar a issue inteira concluída.

- [ ] Para reinício, exibir proposta e aceitar/recusar; proponente pode cancelar; uma recusa encerra votação.
- [ ] Para reinício, exigir confirmação de todos, incluindo desconectados quando retornarem, sem expiração ou aprovação automática.
- [ ] Partida continua enquanto aguarda; persistir proposta/votos e restaurá-los após reinício.
- [ ] Reinício aprovado volta à preparação com mesmos participantes e decks selecionados, permitindo troca.
- [ ] Novo início limpa mesa/contadores, restaura vida inicial, carrega/embaralha decks e refaz sorteio.
- [x] Encerramento por pelo menos metade dos participantes, com arredondamento para cima, marca partida finalizada e fecha a sala, rejeitando novas ações de jogo e conservando snapshot final e log. Funciona em partida solo.
- [ ] Se deck selecionado tiver sido excluído, preparação permite selecionar outro sem corromper estado anterior.
- [ ] Não implementar tela de histórico/replay nem retenção obrigatória de snapshot por ação.
- [ ] Interface PT-BR por toque/mouse; testes cobrem unanimidade, recusa, cancelamento, desconectado, reinício e conservação após encerramento.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
