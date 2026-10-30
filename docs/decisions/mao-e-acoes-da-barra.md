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

## Segunda rodada — menus do jogador, fichas e grimório

Pedido explícito do usuário em 29/10/2026: revisar e corrigir os menus que
ainda fugiam do padrão. Ele citou o menu de vida do jogador e o de fichas, que
abria um painel no meio da tela em vez de seguir como subtela perto da mão.

- **Seu jogador:** vida no stepper grande (− vermelho, valor digitável em
  Cinzel, + verde) e os cinco marcadores em colunas no mesmo painel, como no
  item 8 do system design. A subtela "Marcadores" deixou de existir. Para
  outros jogadores, o painel mostra a vida e só os marcadores com valor.
- **Fichas:** viraram subtelas do popover "Ações do jogo" (Criar ficha → Do
  catálogo / Personalizada), ancoradas acima do "Mais". O atalho `f` abre o
  mesmo popover nessa subtela. A busca segue o item 7 (ícone, × para limpar,
  contagem ao lado) e a lista usa linhas de 32px com "Criar" secundário.
- **Grimório:** "De onde" virou seletor de duas opções à vista (item 6). Os
  botões de concluir usam o primário em Cinzel, e "Embaralhar" ficou sem ›.
- **Mão:** em repouso, a caixa da carta tem 40% da altura e mostra o topo da
  arte; no hover, cresce até a carta inteira. Assim a área clicável fica toda
  na tela.

## Terceira rodada — criar ficha em tela única com abas

Pedido explícito do usuário em 30/10/2026: o formulário de ficha segue as
pranchas "Criar ficha", com paridade 1:1, numa tela só com as abas "Do
catálogo" e "Personalizada". Respostas do usuário às divergências levantadas:

- **Linha de tipo e P/R embaixo da carta:** "não precisa colocar essa linha
  com tipo de criatura e poder, deixe sem". A API não mudou.
- **Busca:** placeholder fiel ao que a busca faz (só por nome), em vez de
  "anjo, tesouro, 1/1…".
- **Prévia da ficha personalizada:** "mantenha funcionamento como está hoje,
  sem esse preview do design". O formulário ocupa a largura toda, sem a
  coluna de prévia, e a ficha continua entrando no campo como antes.

Implementado: catálogo em grade de 4 colunas (3 no celular, 2 abaixo de
420px). Cada ficha tem selo de P/R e mostra "+ Criar" no hover. Clicar na
ficha a cria, conforme a dica "clique na ficha para criar", por isso o modal
de imagem do catálogo saiu. O rodapé traz o resultado ("rafa criou a ficha
Beast (3/3).").
