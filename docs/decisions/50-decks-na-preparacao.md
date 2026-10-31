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
Na época, mulligan permanecia como recurso futuro. O criador altera esses campos na
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
mesmas permissões do desktop continuam em vigor, inclusive o tipo de mulligan.

## Tipo de mulligan na preparação

Em 29/10/2026, depois de a [decisão de mulligan](49-mulligan-e-selecao-da-mao.md)
ser integrada à `master`, o usuário pediu que a configuração da sala nesta
preparação refletisse o modo de mulligan usado ao iniciar a partida. O card
**Mulligan** das regras deixa de ser um recurso futuro desabilitado e passa a
oferecer **Padrão** e **Aconchegaz**, com o padrão selecionado inicialmente.
Somente o criador escolhe; os demais veem a opção desabilitada e sincronizada.

O card usa o endpoint existente `PUT /api/rooms/{id}/mulligan-mode`, sem
incluir o modo em `PATCH /api/rooms/{id}/settings`. O modo gravado na sala é
copiado para a partida ao iniciar, como já fazia o fluxo de mulligan.

Limitação observada: o mulligan exige sete cartas na mão. Com a compra inicial
desligada, a janela de mulligan existe, mas só pode ser usada se o jogador
comprar sete cartas manualmente antes do primeiro avanço de turno.

## Importar e editar o deck na preparação

Em 31/10/2026, o usuário pediu para importar um `.cod` e editar o deck sem sair
da preparação: um botão de importar junto do seletor e o card do deck escolhido
abrindo, com um lápis no canto, a mesma tela de detalhe de **Meus decks**, sem a
lista de decks ao lado. A ideia de colar o conteúdo do `.cod` foi descartada
pelo usuário ao saber que o arquivo é XML.

Perguntado sobre a edição depois de marcar pronto, respondeu que é preciso
desfazer o pronto. Perguntado se os demais jogadores devem ver a troca de
comandante em tempo real, respondeu que sim.

- `PUT /api/decks/{id}/commander` responde 409 enquanto o deck estiver em uma
  sala em que o dono está pronto ou que já define a ordem dos turnos. A regra
  fica no servidor porque o comandante é lido ao iniciar a partida e o mesmo
  endpoint é usado em **Meus decks**. A interface esconde o lápis e desabilita
  a importação nesse estado.
- Cada participante ganha `deckRevision`, um contador no snapshot da sala,
  incrementado quando o comandante muda. O SSE existente o entrega e os membros
  recarregam `preparation-decks`. A lista pública recebe apenas o número, sem
  nomes ou imagens, mantendo a regra acima.
- `decks` conhece as salas pela interface `RoomUsage`, ligada em `serve.go`, sem
  depender do pacote `rooms`.
- Decisões de implementação, não pedidas pelo usuário: o deck importado na
  preparação já fica selecionado, e o botão **Excluir deck** fica de fora do
  pop-up.

Limitação: a checagem do pronto e a gravação do comandante não ocorrem na mesma
transação. Excluir um deck em uso por um jogador pronto continua como antes.
