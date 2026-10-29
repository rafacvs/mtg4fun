# Identidade dos decks na preparação

## Aprovação explícita

Em 29/10/2026, ao pedir uma preparação de jogo que destaque os decks dos
jogadores, o usuário aprovou mostrar aos participantes da sala o nome do deck
e a imagem do comandante ou de uma carta representativa, mantendo a lista de
cartas privada. Usuários fora da sala não recebem esses dados.

## Implementação

Durante a preparação, `GET /api/rooms/{id}/preparation-decks` exige sessão e
participação na sala e retorna somente identificador do jogador, nome do deck
selecionado e nome de uma carta para obter a imagem. A carta é o comandante
quando definido; caso contrário, é a primeira carta do deck. Não retorna a
lista nem quantidades. A resposta não é armazenada em cache, e salas iniciadas
ou não acessíveis retornam 404. O cliente atualiza os dados ao observar uma
mudança de escolha pelo SSE existente. Se a imagem não estiver disponível,
mostra o verso da carta. A lista pública de salas e seu SSE não ganham nomes
ou imagens de decks.

## Regras na nova apresentação (histórico)

Em 29/10/2026, o usuário solicitou a referência visual da preparação e
escolheu apresentar os controles de regras ainda não implementados
**desabilitados como recursos futuros**. A faixa identifica essa limitação e
mostra a vida da sala, o posicionamento automático do comandante definido,
a compra automática de até sete cartas e a ausência de mulligan automático.
Não há alteração das regras ou opções persistidas da partida nesta etapa.

## Configuração autorizada posteriormente

Esta decisão substitui o estado desabilitado descrito acima.

Em 29/10/2026, o usuário autorizou editar a vida inicial, escolher se o
comandante começa em comando e escolher a compra inicial de até sete cartas.
Mulligan permanece como recurso futuro. O criador altera esses campos na
preparação; os participantes acompanham os valores pelo SSE existente.
A vida usa o intervalo inteiro de 1 a 999 já aplicado na criação da sala.

As alterações são gravadas no snapshot da sala sob bloqueio transacional e
aplicadas ao iniciar. O endpoint parcial `PATCH /api/rooms/{id}/settings`
aceita `life`, `commanderToCommand` e `drawOpeningHand`; apenas o criador pode
alterar uma sala em preparação. Os dois switches padrão são ligados, inclusive
para snapshots anteriores sem esses campos. Desligar o comandante mantém a
carta no grimório embaralhado; desligar a compra inicia com a mão vazia.

## Preparação em telas móveis

A apresentação móvel usa uma mesa compacta e lista de jogadores, com painéis
inferiores para escolher o deck e consultar as regras. A ação principal muda
conforme prontidão e autoria da sala. A mesma configuração persistida e as
mesmas permissões do desktop continuam em vigor; mulligan permanece futuro.
