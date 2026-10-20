# Grade do campo de batalha

## Proposta e aprovação explícita

Em 20/10/2026, nesta conversa, o usuário pediu corrigir o posicionamento das
cartas no campo da branch `refactor/game-ui`: o campo deve continuar usável em
qualquer resolução, as cartas devem ficar em fileiras e colunas, a pilha de
uma, duas ou três cartas e a carta deitada definem o espaço ocupado, e a carta
solta não pode aparecer primeiro no topo para só depois ir ao destino.

A conversa usou a skill `grilling`. O usuário aprovou:

- Trocar o cálculo que empurrava as pilhas por uma grade. `positionX` passa a
  ser o índice da coluna; `row` continua o índice da fileira; `stackOrder`
  continua a ordem na pilha, no máximo três.
- O canto superior esquerdo fica fixo. O campo cresce para a direita e para
  baixo, com células vazias além da última carta e, quando a área visível é
  maior, até cobri-la.
- A célula tem o tamanho da própria pilha. Carta deitada e cartas empilhadas
  ocupam mais espaço. As cartas à direita na mesma fileira deslizam; as
  fileiras abaixo descem. As outras fileiras não andam para o lado. Virar uma
  carta não regrava a coluna das vizinhas.
- Uma coluna vazia entre cartas mantém a largura de uma carta em pé. Soltar
  numa pilha com espaço coloca a carta por cima. Soltar numa pilha cheia usa a
  próxima coluna à direita com espaço naquela fileira.
- A carta que entra pelo arraste nasce na célula solta, numa única ação de
  movimento. Ficha, cópia, transferência e mover pelo detalhe entram na
  primeira célula livre da fileira 0. Se essa célula estiver fora da área
  visível, o campo rola o mínimo para mostrá-la.
- Não há migration nem conversão de partidas já salvas. O índice usa o mesmo
  campo JSON `positionX` de `matches.snapshot`.

Essa autorização substitui, para o posicionamento, a posição horizontal livre
descrita na spec [02](../specs/02-mesa-e-interface.md) e o espaçamento fixo
registrado na [decisão 22](22-ajustes-da-mesa.md). Não muda banco, permissões,
limite de três cartas na pilha nem o restante das regras da mesa.

## Correção das miniaturas da visão geral

Após os refinamentos visuais, o usuário informou que a visão geral mostrava
mesas vazias e pediu corrigir a prévia. A inspeção da partida local confirmou
que as cartas estavam presentes, mas posições salvas como 120, 240 e 720
ganhavam centenas de células vazias após a troca para índices de coluna.
A miniatura ajustava toda essa largura ao painel, deixando cartas menores que
um pixel (medidos entre 0,43 e 1,21 px na tela desktop de 1440×900).

A correção é somente na projeção da miniatura: retira espaços vazios iniciais
e limita intervalos entre grupos ocupados a uma célula vazia, por fileira;
fileiras afastadas também são compactadas. Mantém a ordem dos grupos,
pilhas, sobreposição, cartas deitadas e o mesmo cálculo de dimensões da grade.
Não converte dados, não grava coordenadas e não muda o campo em foco nem as
regras de posicionamento aprovadas. Essa correção de apresentação foi feita
no escopo do pedido explícito do usuário, na mesma branch e sem push.

Verificação: TypeScript passou. Três testes unitários específicos de
`overviewLayout.test.ts` passaram com Node no serviço `app` (o Node do host
não suporta `--experimental-strip-types`). Cobrem coordenadas esparsas sem
mutação, geometria de grade compacta com pilha mista/cartas deitadas e campo
vazio. O cenário de navegador existente ganhou regressão com posições
120/720 pela API real e verificação de dimensões visíveis, foco e ausência
de alteração do snapshot; essa suíte não foi executada nesta correção.

Chromium contra a aplicação/API local existente: 27 cartas visíveis nas
quatro miniaturas em 1440×900, 390×844 e 844×390, com dimensões mínimas de
24,20 px, 10,91 px e 10,29 px de largura, respectivamente; alternância entre
miniatura e campo funcionando. Snapshot público e log iguais antes/depois,
sem erro JavaScript. Capturas `app/test-results/overview-fixed-*.png`.
Sem build ou suíte completa.
