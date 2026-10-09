# 06: Comprar e mover cartas entre zonas

**What to build:** Jogadores compram X cartas e movimentam suas cartas entre zonas, acompanhando estado e log consistentes e duráveis.

**Blocked by:** 05: Preparar e iniciar uma partida persistente.

**Status:** ready-for-agent

- [ ] Disponibilizar grimório, mão, campo, cemitério, exílio e comando; nenhuma reserva/sideboard.
- [ ] Comprar X move cartas do topo para mão; movimentos entre zonas preservam identidade e quantidade.
- [ ] Ao retornar ao grimório, escolher topo/fundo, com topo como opção rápida; corrigir compras por movimento comum.
- [ ] Mão e conteúdo/ordem do grimório são privados; zonas públicas exibem informações permitidas.
- [ ] Servidor verifica participação e permissão; payloads e log de oponentes não contêm identidades, imagens ou ordem privadas.
- [ ] Cada ação aceita grava snapshot atualizado e log na mesma transação; sucesso e estado confirmado só são publicados depois da gravação.
- [ ] Falha de persistência não muda estado confirmado; ações concorrentes não duplicam nem perdem cartas.
- [ ] Reenvio da mesma intenção após perda de confirmação não repete a operação; escolher/documentar mecanismo de idempotência.
- [ ] Disponibilizar mão, ações e log em interface PT-BR com mouse/toque, sem chat de conversa.
- [ ] Após reinício, recuperar zonas, mão, ordem e log; testes públicos incluem concorrência, reenvio, falha parcial e privacidade.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
