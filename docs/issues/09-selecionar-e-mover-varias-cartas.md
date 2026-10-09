# 09: Selecionar e mover várias cartas

**What to build:** Jogadores selecionam múltiplas cartas e as movem juntas sem criar agrupamento permanente.

**Blocked by:** 08: Posicionar e sobrepor cartas em fileiras.

**Status:** ready-for-agent

- [ ] Desktop seleciona por arraste de área; celular tem modo explícito de seleção e adiciona/remove cartas por toque.
- [ ] Estado visual distingue seleção e permite limpar/sair do modo.
- [ ] Mover seleção preserva disposição relativa compatível com fileiras e atualiza as cartas como uma ação coletiva consistente.
- [ ] Verificar permissão para todas as cartas; falha não deixa movimento parcialmente confirmado.
- [ ] Sobreposição anterior não força seleção conjunta e movimento não cria vínculo permanente.
- [ ] Posições resultantes sincronizam e são persistidas com log; seleção local não precisa integrar snapshot compartilhado.
- [ ] Testes por mouse/toque verificam seleção, movimento e manipulação individual posterior; teste público verifica atomicidade.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
