# 05: Preparar e iniciar uma partida persistente

**What to build:** Participantes escolhem decks e confirmam prontidão; o criador inicia uma mesa com cartas, vida e ordem de turnos salvas.

**Blocked by:** 02: Importar e reutilizar decks .cod; 03: Criar e entrar em salas.

**Status:** ready-for-agent

- [ ] Cada participante seleciona deck próprio e confirma prontidão; somente criador inicia e somente quando todos estão prontos.
- [ ] Início instancia as cartas de cada deck em seu grimório e embaralha; define dono e controlador e vida inicial configurada no banco.
- [ ] Ordem é sorteada pelo servidor com D20, maior primeiro; somente empatados rolam novamente para resolver posições dentro do grupo, repetindo se necessário.
- [ ] Resultado e ordem ficam registrados e persistidos; retomada não refaz sorteio ou embaralhamento.
- [ ] Participantes ficam fixos após iniciar: novos usuários não entram e desconexão não libera vaga.
- [ ] Renderizar campos e zonas iniciais em desktop e celular horizontal; compra inicial é manual, sem seleção especial de comandante.
- [ ] Salvar estado inicial e log atomicamente antes de confirmar/publicar início; falha não anuncia partida iniciada.
- [ ] Partida instancia dados independentes da biblioteca: excluir deck ou atualizar catálogo não corrompe o jogo iniciado.
- [ ] Não aplicar regras de formato, tamanho de deck ou condição de vitória; documentar mínimo de participantes escolhido como decisão de implementação.
- [ ] Testes públicos cobrem prontidão, autorização, desempates controlados, falha de gravação e recuperação após reinício.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
