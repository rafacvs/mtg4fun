# Limite da visão do campo

## Aprovação

Em 30/10/2026, o usuário relatou na conversa que arrastar a visão escondia cartas
atrás do trilho e do cabeçalho, e pediu que elas permanecessem visíveis.

## Causa

O tamanho da área de rolagem vinha de `fitBattlefield`, que sempre inclui ao menos
duas colunas e duas linhas vazias como destino de soltura. Reproduzido na mesa
local: com 8 cartas inteiras na visão (zoom 1), a rolagem de 64 × 110 px cortava 5;
no zoom 6, todas saíam da tela.

## Implementação

As células vazias continuam sendo destinos, mas o alcance da rolagem agora vem de
`viewExtent`, calculado sobre as cartas. Se elas cabem, a visão não se move. Se
excedem um eixo, a rolagem alcança no máximo uma célula vazia além da última carta,
e menos sob zoom alto, para que ela continue na tela.

**Limite conhecido:** uma carta maior que a visão, sob zoom muito alto, ainda fica
parcialmente fora; o mesmo vale para as cartas da borda durante a rolagem quando o
conjunto não cabe.

## Verificação

Teste unitário de `viewExtent` e os fluxos `campo-limites`, `navegacao-campo` e
`posicionamento` em navegador, com API e MySQL reais.
