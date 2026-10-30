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
