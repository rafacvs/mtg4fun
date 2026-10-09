# 12: Modificar vida e contadores

**What to build:** Jogadores alteram vida e contadores nomeados em jogadores e cartas, com registro e valores compartilhados.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Menu de contadores permite alterar vida inicializada pela configuração do banco durante o jogo.
- [ ] Criar/alterar contadores com nome e valor em cartas e jogadores, sem interpretar regras ou condições de derrota.
- [ ] Aplicar permissões adequadas por jogador/controlador e filtrar dados ligados a cartas privadas.
- [ ] Alterações concorrentes resultam em valores consistentes; documentar semântica de definir/incrementar usada.
- [ ] Salvar snapshot e log antes de confirmar e restaurar valores após reinício.
- [ ] Controles PT-BR funcionam com mouse/toque; testes públicos e fluxo de navegador cobrem vida, contadores, autorização e durabilidade.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
