# Preparação com dados 3D e confirmação da ordem

## Aprovação explícita

Em 30/10/2026, o usuário forneceu as referências visuais, message.txt e
dados-3d.zip. Após apresentação do impacto em contratos, persistência e fluxo,
aprovou explicitamente a implementação em uma nova branch e o uso da porta 8080.

A aprovação cobre d20 fixo, brincadeira antes do início, rolagens manuais
repetíveis até confirmação, bloqueio de confirmação em empate com resultado já
confirmado, abertura automática após todos confirmarem, manutenção dos lugares
na desconexão, ausência de cancelamento após iniciar e limite de cinco rolagens
por segundo por participante. Substitui o sorteio automático no fluxo visual.

## Implementação

O cliente usa POST /api/rooms/{id}/preparation/start. Somente o criador,
com todos prontos, inicia a etapa determining_order. A transação instancia e
embaralha os decks e fecha as vagas. O snapshot da partida fica com
pendingOrder; GET da partida e ações não disponibilizam as cartas nesse estado.
O endpoint anterior POST /start continua disponível com seu comportamento
anterior para compatibilidade com integrações existentes.

GET /api/rooms/{id}/preparation e POST /api/rooms/{id}/preparation/actions
exigem participação. O segundo recebe intentId UUID e kind roll ou confirm;
confirm recebe rollId da rolagem atual. Rolagens ficam no snapshot da sala;
idempotência usa room_events na mesma transação, com UUID sem hífens.
Nenhuma informação de dados é acrescentada ao SSE público das salas.
Os participantes consultam o estado da preparação a cada 700 ms.

Resultados usam aleatoriedade do servidor. O motor canvas fornecido no ZIP
anima geometria, quique e colisões localmente e termina no resultado recebido.
O registro visual aguarda onLand. O histórico persistido registra também as
rolagens refeitas. Dados antigos são recuperados ao recarregar a página.

A última confirmação salva ordem e estado started atomicamente, sem refazer
os decks, e atualiza o evento inicial com a ordem definitiva. O cliente mostra
a posição final antes de abrir a mesa; recarregar uma partida iniciada abre
diretamente o jogo. Desconexão não altera lugares nem confirmações.

O layout usa o tema existente, sem biblioteca adicional. O aro oval usa
camadas contínuas de cor e sombra para evitar as emendas diagonais da borda
ridge apontadas pelo usuário.

Na revisão visual seguinte, o usuário pediu a composição da referência:
cabeçalho dentro do quadro, faixa inferior com prontidão e início, painéis
laterais separados e proporções que mantenham regras e rolagem acessíveis.
Foram ajustados os lugares superior/laterais e a altura em telas baixas.

O usuário também solicitou segurar o botão por três segundos ou mais para
lançar o dado para fora. O gesto é resolvido ao soltar; cancelamento do toque
ou saída do botão cancela o lançamento. O campo aditivo fallOff é persistido
e compartilhado com o resultado. O motor passa pelo aro e cai fora do feltro,
mantendo o resultado do servidor no registro. O teste de navegador verifica o
gesto real e a requisição; o motor é exercitado até concluir a queda.

Verificação da revisão: gesto completo passou em desktop e celular nas duas
orientações. O teste de layout confere cabeçalho e início dentro do quadro,
painéis separados, regras e botão de rolar dentro da tela em 1440×900 e
1280×720; capturas dessas duas dimensões foram inspecionadas.

Na revisão seguinte, o usuário pediu regras em posição fixa e histórico com
rolagem própria. No desktop, a grade reserva a linha inferior para as regras;
o registro usa somente o espaço restante da lateral. O histórico é cronológico,
sem remover entradas da visualização, e acompanha o fim enquanto o usuário
não estiver consultando entradas anteriores. A lista tem rolagem interna
por mouse, toque e teclado, sem expandir os painéis.

Após aprovar o quadro da mesa, o usuário pediu o botão de rolagem dentro dele:
o botão passou para a faixa inferior, ao lado de iniciar, mantendo o gesto
de três segundos. O registro lateral apresenta somente o histórico e valores.
No celular, a rolagem fica junto das ações de preparação.

Nos ajustes finais, o botão compacto passou a usar o arquivo d20.svg
fornecido e o rótulo Rolar D20. O registro perdeu a etiqueta Brincadeira e
recebeu shields com a inicial, resultados em D20 facetado e destaque dourado
para as rolagens valendo. A faixa inferior mostra shields de todos os
participantes, mesmo antes da prontidão, e os nomes de quem falta. Os shields
da faixa medem 14×18 px e ficam alinhados verticalmente ao texto.

## Verificação

Teste HTTP com executável e MySQL reais cobre participantes, autorização do
criador, idempotência, empate controlado, bloqueio após confirmação,
indisponibilidade da partida antes da ordem e recuperação após reinício.
O teste de navegador percorre brincadeira, recarga, preparação, confirmação
e abertura automática com API e MySQL isolados nas três orientações.
Validação em 30/10/2026: build/typecheck do frontend e testes de todos os
módulos internos Go passaram. A integração nova e a regressão de início
anterior passaram (2 cenários). O fluxo de navegador passou no desktop e no
celular vertical/horizontal; o desktop foi repetido após corrigir a
reconstrução do mapa de confirmações. Capturas de preparação e ordem foram
inspecionadas; o aro contínuo foi conferido nessas capturas. A suíte completa
de regressão de navegador não foi executada.

## Revisão da confirmação da ordem em 30/10/2026

O usuário pediu que a confirmação se aproximasse da referência com quatro
jogadores ao redor do oval, classificação abaixo do quadro e dois painéis
laterais. Pediu também a padronização dos quatro cantos dos painéis e que
“Quem começa?” destaque a pessoa com a maior rolagem, em vez do número isolado.
Essa autorização cobre apresentação; os contratos e as regras de confirmação
permanecem os já aprovados acima.

A composição agora reserva altura para a classificação, alinha informações da
sala no cabeçalho e usa shields e D20 facetados nos lugares e na classificação.
Os três quadros usam o mesmo ornamento, rotacionado em cada canto e afastado
da borda. Antes da definição, o destaque apresenta os nomes com a maior
rolagem já concluída, indicando empate quando houver. Após todos confirmarem,
mostra a posição pessoal, a sequência e o progresso até a abertura automática.
O histórico preserva rolagem interna.

Verificação desta revisão: build/typecheck e `git diff --check` passaram.
A suíte focada de navegador passou com API e MySQL reais: fluxo completo
no desktop e celular vertical/horizontal, mais composição de quatro jogadores
em 1440×900 e 1280×720. As capturas da ordem provisória e definida foram
inspecionadas. O teste verifica o destaque do nome da maior rolagem concluída,
a posição final e a abertura da mesa. Os cenários exclusivos de desktop são
omitidos nas duas orientações móveis. A regressão completa não foi executada.

## Escala de força da rolagem livre em 30/10/2026

O usuário pediu explicitamente, em conversa, a mudança do gesto: sensação de
pinball na brincadeira e apenas o clique na etapa que define a ordem. Esse pedido
substitui o gesto de três segundos descrito acima. Depois de testar na porta 8080,
pediu o botão inteiro mudando de cor e uma diferença de força bem perceptível, com
o clique equivalente à força 4, no meio da mesa, e os níveis altos como um tiro.

Pedido pelo usuário:

- Segurar até 2 segundos é o lançamento normal, igual ao clique.
- Depois disso, a escala de 1 a 10 vai do verde claro ao vermelho forte.
- De 1 a 8 o dado cai na mesa; quanto menor, mais perto de quem joga, e quanto
  maior, mais reto e rápido.
- Em 9 e 10 o dado cai para fora e não aparece no registro.

Na segunda revisão, o usuário disse que segurar ainda parecia igual a clicar. A
medição confirmou: o arremesso segue a profundidade da mesa, que a perspectiva
achata, e o aro tirava metade da velocidade, então os níveis paravam parecidos.

Escolhas de implementação, não pedidas literalmente: cada nível dura 400 ms, de
modo que a força 10 chega em 5,6 s. O botão sobe a partir do dourado e a escala
passa pelo amarelo. Forças altas têm velocidade bem maior, menos atrito, ricochete
com desvio pela semente, rastro e anel de impacto no aro. Sair do botão continua
cancelando o lançamento. O gesto é resolvido ao soltar, porque o toque longo não
gera click no celular.

O contrato de POST /preparation/actions troca a entrada fallOff por power (0 a 10;
fora disso, 400). O servidor persiste power e deriva fallOff (9 ou mais), então
todos os clientes animam o mesmo lançamento. Na etapa determining_order o valor é
descartado e a rolagem fica sempre normal. O GET de preparação continua listando
os dados perdidos, para que os outros jogadores vejam a queda; é o registro da
tela que os omite. Rolagens antigas com fallOff também deixam de aparecer nele.

Verificação desta revisão: testes unitários do frontend, typecheck e build
passaram, assim como a integração HTTP da preparação. A suíte focada de navegador
passou com API e MySQL isolados, no desktop e no celular nas duas orientações, com
toque real via CDP. Um cenário mede no canvas o dado lançado pelo botão real; em
uma execução, força 1 andou 24 px em 0,7 s, o clique 117 px em 1,6 s e a força 8
1.611 px em 4,9 s. A sensação do lançamento depende de avaliação do usuário. A
regressão completa não foi executada.

## Mira e carga contínua em 30/10/2026

Depois de aprovar a força na porta 8080, o usuário pediu dois ajustes: direção
aleatória de até 30 graus para cada lado do reto, e carga mais rápida e infinita,
indo do verde ao vermelho e voltando, cada vez mais rápido. O pedido substitui a
subida única até a força 10 e os 400 ms por nível descritos acima.

O desvio usa a semente da rolagem, então todos os clientes veem a mesma direção.
Escolhas de implementação, não pedidas literalmente: o primeiro nível dura 220 ms
(a força 10 chega em cerca de 4 s), cada passada encurta 20% e o limite é de 40 ms
por nível, para que os níveis ainda possam ser vistos. A força lançada é a que
estiver no botão ao soltar.

Verificação desta revisão: testes unitários do frontend, typecheck e build
passaram. A suíte focada de navegador cobre a ida e volta da carga no botão real,
com as passadas ficando mais curtas, e a medição do lançamento no canvas. O
resultado desta execução está na descrição do PR. A regressão completa não foi
executada.

## Quiques mais altos em 30/10/2026

O usuário achou os dados realistas demais e pediu algo mais gamificado, com mais
pulos e diferença de força mais visível ao segurar o botão. O pedido não muda o
contrato nem a regra de forças 1 a 8 na mesa e 9 e 10 para fora.

Escolhas de implementação, não pedidas literalmente: gravidade menor, retorno do
quique que cresce com a força, velocidade na mesa e impacto no aro convertidos em
salto. A altura é limitada para o dado continuar no canvas, que
no desktop sobe 110 px sobre o cabeçalho. No celular, a mesa recorta o canvas, então
os pulos são mais baixos.

Ao testar, o usuário disse que os dados disparavam retos, sem subir, e que batiam na
parede e paravam. Pediu que as paredes também os jogassem para cima, para os dados
pularem na mesa e criarem expectativa. Isso substitui o “mais reto” das forças altas
pedido na revisão anterior: todos os níveis saem para cima, e o aro devolve mais
velocidade e sempre dá um salto a partir de uma batida mínima.

Verificação desta revisão: testes unitários e typecheck do frontend passaram. A suíte
de `preparation-dice.spec.ts` passou com API e MySQL isolados nas três telas; em uma
execução no desktop, o clique levou 2,2 s com 2 pulos visíveis no canvas, e a força 8
levou 9,9 s com 11, sem encostar no topo do canvas. Quatro cenários de
`preparacao-mesa.spec.ts` e `preparacao-mobile.spec.ts` falham igualmente na `master`,
sem esta mudança. A sensação do lançamento depende de avaliação do usuário. A regressão
completa não foi executada.

## Aro, parede e carga em 30/10/2026

Depois de testar, o usuário aprovou a subida e os quiques, mas disse que a parede
jogando para cima parecia um ventilador. Pediu física normal de parede, com só o aro
dourado no chão dando um pequeno pulo. Pediu também que a carga comece com 1 segundo
e seja mais rápida, acelerando sem limite para que segurar demais tire o controle.
Isso substitui a batida no aro da revisão anterior, os 2 segundos e o limite de 40 ms
por nível.

Escolhas de implementação, não pedidas literalmente: o aro vale até 1,6 raio do dado
de altura e dá um impulso de 180 a 320 px/s; o anel de impacto só aparece nessa batida.
A primeira subida leva cerca de 1 s e a velocidade da carga cresce continuamente.

Verificação desta revisão: testes unitários e typecheck do frontend passaram, assim
como `preparation-dice.spec.ts` com API e MySQL isolados. A medição no canvas ficou
menos exigente: como a parede não dá mais pulos, a contagem pela posição na tela só
separa o tiro do clique por uma pequena margem, e o teste passou a exigir mais pulos e
pulo mais alto. A contagem de cinco vezes mais pulos fica no teste unitário. Em uma
execução no desktop, a força 8 levou 5,3 s. A sensação depende de avaliação do usuário.
A regressão completa não foi executada.

## Animação acompanhável em 30/10/2026

O usuário aprovou o aro, mas pediu a barra 2,5 vezes mais lenta no início, mantendo a
aceleração infinita. Disse que a evolução entre clique e forças não estava clara e que
tudo estava rápido demais. Pediu animação suave para acompanhar o dado saindo, caindo
e quicando, com a imagem de bolinhas de gude descendo uma escada, “uma chuva de dado”
em menor escala. Isso substitui o “como um tiro” das forças altas.

Escolhas de implementação, não pedidas literalmente: gravidade de 1.900 para 750 px/s²,
velocidades de lançamento muito menores (força 8 de 3.800 para 720 px/s), altura do
primeiro pulo como fração do espaço acima da mesa, crescendo a cada nível, retorno do
quique maior e giro menor. Cada rolagem continua sendo um dado, com o resultado do
servidor: a chuva vem de várias rolagens seguidas, sem dados extras.

Verificação desta revisão: testes unitários e typecheck do frontend passaram, assim
como `preparation-dice.spec.ts` com API e MySQL isolados nas três telas. Em uma execução
no desktop, a força 1 levou 1,4 s, o clique 2,8 s e a força 8 7,8 s até parar. A sensação
depende de avaliação do usuário. A regressão completa não foi executada.

## Forças por cor e fim da queda em 30/10/2026

O usuário achou a revisão anterior lenta demais e descreveu cada faixa: o clique é uma
jogada média, em arco; o verde mais fraco vai mais para a frente que antes, quase não
sobe, cai, anda um pouco e para; o laranja é mais forte e um pouco mais alto, mais tiro
que parábola. Depois pediu para tirar a regra de 9 e 10 saírem da arena: passam a ser
só tiros mais fortes. Isso substitui a queda e o “não aparece no registro” descritos
acima.

Escolhas de implementação, não pedidas literalmente: gravidade de 750 para 1.100 px/s²,
força 1 a 150 px/s e pulo de 10% do espaço, clique a 175 px/s e 45%, força 7 a 820 px/s
e 60%, força 10 a 1.900 px/s e 65%. O campo fallOff saiu do servidor e do cliente; o
contrato continua aceitando power de 0 a 10. Rolagens antigas com fallOff em salas ainda
em preparação passam a aparecer no registro, porque a marca deixa de ser lida.

Verificação desta revisão: testes unitários, typecheck do frontend, testes do pacote
`internal/rooms` e a integração HTTP da preparação passaram. `preparation-dice.spec.ts`
passou com API e MySQL isolados nas três telas. Em uma execução no desktop, a força 1
levou 1,2 s e andou 59 px, o clique 2,4 s e 223 px, a força 8 5,8 s e 1.422 px, e a
força 10 5,7 s e 1.920 px. A sensação depende de avaliação do usuário. A regressão
completa não foi executada.

## Mais potência em 30/10/2026

O usuário achou o lançamento lento e pediu mais força e velocidade, principalmente
conforme a barra, sem exagero. Escolhas de implementação, não pedidas literalmente:
gravidade de 1.100 para 1.400 px/s², força 1 de 150 para 170 px/s, clique de 175 para
200, força 7 de 820 para 1.150, força 8 de 1.150 para 1.650 e força 10 de 1.900 para
2.800. O verde e o clique continuam caindo nos mesmos lugares.

Verificação desta revisão: testes unitários, typecheck e `preparation-dice.spec.ts`
passaram nas três telas com API e MySQL isolados, em um clone temporário, porque o
checkout principal estava em uso por outra tarefa. Em uma execução no desktop, a
distância no primeiro meio segundo foi de 88 px no clique, 568 px na força 8 e 892 px
na força 10. A sensação depende de avaliação do usuário. A regressão completa não foi
executada.

## Feltro que devolve o pulo em 30/10/2026

O usuário gostou da potência e pediu o chão com física para empurrar os dados para
cima, para quicarem mais. Escolhas de implementação, não pedidas literalmente: retorno
do quique maior em todas as forças, de 0,42 na força 1 a 0,83 nas forças 8 a 10, e mais
velocidade convertida em salto (0,22 para 0,32). As velocidades de 1 a 4 caíram um
pouco para o verde e o clique continuarem caindo nos mesmos lugares.

Verificação desta revisão: testes unitários, typecheck e `preparation-dice.spec.ts`
passaram nas três telas com API e MySQL isolados. Em uma execução no desktop, o clique
levou 2,6 s com 3 pulos visíveis, a força 8 6,1 s com 4 e a força 10 6,8 s com 6, sem
sair do canvas. A sensação depende de avaliação do usuário. A regressão completa não
foi executada.

