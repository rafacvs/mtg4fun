# 17: Votar pelo reinício ou encerramento

**What to build:** Qualquer participante propõe reiniciar ou finalizar e todos decidem, preservando votos e estado mesmo com desconexões.

**Blocked by:** 16: Retomar partidas e transferir conexão de controle.

**Status:** ready-for-agent

- [ ] Exibir proposta e aceitar/recusar para participantes; proponente pode cancelar; uma recusa encerra votação.
- [ ] Exigir confirmação de todos, incluindo desconectados quando retornarem, sem expiração ou aprovação automática.
- [ ] Partida continua enquanto aguarda; persistir proposta/votos e restaurá-los após reinício.
- [ ] Reinício aprovado volta à preparação com mesmos participantes e decks selecionados, permitindo troca.
- [ ] Novo início limpa mesa/contadores, restaura vida inicial, carrega/embaralha decks e refaz sorteio.
- [ ] Encerramento aprovado marca partida finalizada e rejeita novas ações de jogo, conservando snapshot final e log.
- [ ] Se deck selecionado tiver sido excluído, preparação permite selecionar outro sem corromper estado anterior.
- [ ] Não implementar tela de histórico/replay nem retenção obrigatória de snapshot por ação.
- [ ] Interface PT-BR por toque/mouse; testes cobrem unanimidade, recusa, cancelamento, desconectado, reinício e conservação após encerramento.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
