# 18: Executar ações sobre múltiplas cartas selecionadas

**What to build:** Jogadores executam movimentos entre zonas, estados e alterações de contadores sobre várias cartas selecionadas.

**Blocked by:** 09: Selecionar e mover várias cartas; 11: Alterar estados e revelar cartas; 12: Modificar vida e contadores.

**Status:** ready-for-agent

- [ ] Usar seleção por área e modo de seleção por toque já existentes, mantendo feedback claro das cartas afetadas.
- [ ] Oferecer movimentos entre zonas com topo/fundo quando pertinente, virar/desvirar e alterações de contadores aplicáveis à seleção.
- [ ] Definir/documentar ordem das cartas ao mover seleção para zona ordenada, sem descartar ou duplicar instâncias.
- [ ] Verificar participação/permissão e aplicabilidade em todas as cartas; erro não deixa ação parcialmente confirmada.
- [ ] Resultado coletivo consistente é salvo atomicamente com log antes da confirmação e propagado com filtragem de privacidade.
- [ ] Reenvio não reaplica ação; estado final recupera após reinício.
- [ ] Seleção não cria vínculo permanente e ações posteriores continuam individuais.
- [ ] Testes públicos cobrem atomicidade, permissões mistas, ordem e reenvio; fluxos com mouse/toque verificam execução coletiva.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
