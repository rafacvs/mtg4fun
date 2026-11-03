# Inversão dos arrastes do campo

Em 03/11/2026, o usuário pediu explicitamente inverter os gestos existentes:
arrastar o espaço vazio com o botão esquerdo seleciona várias cartas e com o
botão direito move a visão do campo. Esse pedido aprova a alteração de
comportamento da [seleção por área](../issues/09-selecionar-e-mover-varias-cartas.md).

A implementação mantém Shift + arraste esquerdo como seleção, arraste de
cartas com o botão esquerdo, limpeza por clique vazio/Escape e interações por
toque. O botão direito navega também pelos campos observados. Não há mudanças
de API, persistência ou dependências.

O usuário confirmou no ambiente local que a inversão funcionou. O build com
TypeScript passou. Na execução inicial de navegador, os dois fluxos de
navegação passaram; `posicionamento.spec.ts` falhou antes da seleção, na
asserção de reordenação da mão. Essa falha permanece fora deste ajuste.

Na verificação final focada, `navegacao-campo.spec.ts` e
`campo-limites.spec.ts` passaram em desktop: seleção com esquerdo sem Shift,
limpeza por Escape e navegação com direito no campo próprio e observado.
