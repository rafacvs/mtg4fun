# 07: Navegar pelos campos no desktop e celular

**What to build:** Cada jogador observa todos os campos quando há espaço ou coloca um deles em foco sem perder a própria mão e ações.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Desktop mostra campos conjuntamente quando há espaço e permite ampliar um jogador.
- [ ] Celular vertical/horizontal mostra campo principal próprio por padrão, visão geral em grade para escolher outro campo e mão/ações próprias na faixa inferior.
- [ ] Botão inferior/flutuante abre ações/configurações; menu e controles em PT-BR.
- [ ] Trocar foco identifica o jogador observado e preserva mão, identidade, permissões e ações próprias.
- [ ] Miniaturas indicam atividade sem trocar foco automaticamente; navegação atende seis participantes.
- [ ] Ambas as orientações mantêm a partida jogável, sem bloqueio para girar o aparelho, preservando conexão e estado. Mudança aprovada na [decisão 28](../decisions/28-ui-mesa-responsiva.md).
- [ ] Fluxos de navegador com mouse/toque verificam foco, acesso às ações, seis campos e troca de orientação sem perda de partida.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
