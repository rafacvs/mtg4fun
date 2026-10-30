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
