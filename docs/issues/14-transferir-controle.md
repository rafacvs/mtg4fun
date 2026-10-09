# 14: Transferir controle de cartas

**What to build:** Jogadores transferem uma carta para o campo de outro participante, que passa a manipulá-la sem mudar seu dono original.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** ready-for-agent

- [ ] Ação explícita seleciona participante e move carta para campo do novo controlador.
- [ ] Dono original permanece; novo controlador recebe permissão e antigo deixa de agir como controlador.
- [ ] Ao sair do campo, oferecer zonas do dono original como destino padrão, com escolha explícita permitida.
- [ ] Não permitir manipulação arbitrária de mão/grimório de outro jogador pela transferência.
- [ ] Estado, permissões e log sincronizam e persistem antes da confirmação.
- [ ] Interface PT-BR por mouse/toque; testes públicos verificam autorização antes/depois, dono, destinos e recuperação.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Escolhas de banco, bibliotecas, contratos e estrutura interna devem ser documentadas durante implementação, com poucas camadas e dependências.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
