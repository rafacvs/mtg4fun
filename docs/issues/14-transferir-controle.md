# 14: Transferir controle de cartas

**What to build:** Jogadores transferem uma carta para o campo de outro participante, que passa a manipulá-la sem mudar seu dono original.

**Blocked by:** 06: Comprar e mover cartas entre zonas.

**Status:** implementado e em revisão na branch `review/issue-09-selecao-e-acoes`, junto da adaptação da seleção.

- [x] Ação explícita seleciona participante e move carta para campo do novo controlador.
- [x] Dono original permanece; novo controlador recebe permissão e antigo deixa de agir como controlador.
- [x] Ao sair do campo, oferecer zonas do dono original como destino padrão, com escolha explícita permitida.
- [x] Não permitir manipulação arbitrária de mão/grimório de outro jogador pela transferência.
- [x] Estado, permissões e log sincronizam e persistem antes da confirmação.
- [x] Interface PT-BR por mouse/toque; testes públicos verificam autorização antes/depois, dono, destinos e recuperação.

## Adaptação à mesa atual

As tasks, autorização, compatibilidade e verificações estão no
[registro da adaptação dos PRs 23 e 24](../decisions/26-adaptar-selecao-e-controle.md).
A implementação usa a paleta e os fluxos atuais; a validação dos PRs antigos
permanece histórica.

## Regras de execução

- Seguir as specs locais de acesso/salas/decks, mesa/interface e servidor/persistência e seu vocabulário; não alterar o escopo para reproduzir a arquitetura do Cockatrice.
- Entregar comportamento completo com armazenamento, contrato público, interface e testes pertinentes; preferir testes de comportamento na API pública e fluxos de navegador para interação.
- Toda nova ação compartilhada deve validar permissão, filtrar informação privada e preservar estado/log após reinício. Não deixar segurança ou persistência para uma etapa posterior.
- Seguir a [política de decisões do AGENTS.md](../../AGENTS.md#requisitos-e-decisões): decisões de grande impacto exigem consulta e aprovação explícita do usuário antes de implementar; documentar a escolha não substitui aprovação.
- Estes tickets compõem uma única primeira versão; entregas intermediárias não são declaração de que o produto completo já está pronto.
