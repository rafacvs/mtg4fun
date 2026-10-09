# 10: Consultar, reordenar e embaralhar o grimório

**What to build:** Jogadores consultam cartas privadamente, reorganizam e movem seleções ou embaralham para executar efeitos manualmente.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Consultar próprio grimório inteiro com busca por nome ou X cartas do topo/fundo em área temporária privada.
- [ ] Permitir reordenar cartas consultadas, enviar às zonas e escolher topo/fundo preservando ordem acordada.
- [ ] Consulta não revela nomes/ordem no payload ou log dos outros jogadores.
- [ ] Embaralhamento separado da consulta; oferecer fechar e embaralhar sem embaralhar automaticamente ao fechar comum.
- [ ] Permitir localizar comandante, movê-lo para comando e embaralhar, sem domínio de formatos.
- [ ] Persistir ordem e movimentos; resolver conflitos com compras/movimentos concorrentes sem perda ou duplicação.
- [ ] Interface PT-BR utilizável com toque e mouse.
- [ ] Testes públicos verificam topo/fundo, reordenação, busca, privacidade, embaralhamento e recuperação; fluxo de navegador cobre separar comandante.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
