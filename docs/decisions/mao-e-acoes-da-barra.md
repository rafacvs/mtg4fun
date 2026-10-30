# Mão, barra de ações e menus da mesa

## Estado

Pedido explícito do usuário na conversa de 29/10/2026: corrigir o layout da
mão, dos botões, das ações e dos menus com paridade visual 1:1 às pranchas
“Mão e ações” (barra do jogador, rolar dado, “Mais”) e à prancha
“Componentes · menus, botões e campos”. O usuário testou no navegador e
aprovou o resultado (“ta show de bola”), pedindo em seguida um ajuste: cartas
da mão mais abaixadas, com cerca de 40% visível, subindo inteiras no hover e
mantendo a prévia ao passar o mouse.

## O que foi implementado

- Desktop: barra preta de 80px, só para os controles; a mão fica em leque, com
  cartas maiores e sobreposição que se ajusta ao espaço. Em repouso, cerca de
  40% de cada carta aparece; o hover a mostra inteira sobre o campo.
- Botões com ícone dourado e rótulo (44px) em “Comprar”, “Desvirar todas” e
  “Mais”, com o estado ligado (borda e texto em ouro) quando o menu está
  aberto. “Passar turno” é o único primário, à direita.
- Popover “Ações do jogo” ancorado acima do botão que o abre. Cabeçalho com
  sobretítulo, título em Cinzel, voltar ‹ só em subtela e fechar × à direita.
  Itens com ícone em quadro de 38px e linha de resultado no pé.
- Subtela “Rolar dado” com o d20 mostrando a última rolagem, o stepper de faces
  e o primário “Rolar dN”.

## Escolhas de interpretação

- O ícone de compra deixou de usar `draw-cards.png` e passou a usar ícone de
  traço, como na prancha. O arquivo continua no repositório.
- As pranchas divergem quanto ao › em “Jogar moeda” e “Corrigir turno”. Segui a
  regra do system design: › só aparece em itens que abrem uma subtela.
- No celular, os comandos mantêm a ordem anterior. “Passar turno” passa a ser
  o primário, conforme a regra de um primário por superfície.
