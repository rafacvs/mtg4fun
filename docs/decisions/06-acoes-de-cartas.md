# Ações de cartas e sincronização de partidas

Issue: [06](../issues/06-comprar-e-mover-cartas.md).

## Aprovação explícita

Durante a implementação da issue 06, os contratos HTTP para ações, o
mecanismo de idempotência e o transporte de atualizações da partida ainda
estavam abertos nas especificações. Foram apresentadas ao usuário as
alternativas de polling HTTP, SSE de partidas e WebSocket, e a proposta de um
endpoint de ações discriminado.

O usuário aprovou explicitamente `POST /api/rooms/{id}/match/actions`, com
`intentId` UUID obrigatório, ações discriminadas de compra e movimento,
idempotência persistida por partida/jogador, visão filtrada em leituras e
respostas, e polling HTTP a cada segundo enquanto a mesa está aberta. A
aprovação não inclui rolagens, moedas ou avanço de turnos, que pertencem à
issue 15.

## Implementação

O corpo da ação de compra usa `{ "intentId", "kind": "draw", "count" }`.
O movimento usa `{ "intentId", "kind": "move", "cardIds", "to" }`; ao
retornar ao grimório, inclui `libraryPlacement` igual a `top` ou `bottom`.
O cliente oferece topo como ação direta.

`match_intents` mantém a chave única `(room_id, actor_id, intent_id)`. A
partida é bloqueada na transação antes de consultar a intenção: uma nova ação
atualiza snapshot, log e intenção juntos; uma repetição retorna a visão atual
sem reaplicar o efeito. A tabela independente evita alterar `match_events`,
pois o esquema existente usa inicialização idempotente sem migrações `ALTER`.

As visões devolvem a mão integral somente ao participante correspondente e
cartas completas de zonas públicas. Grimórios continuam somente como
contagem. O log informa ator, tipo, zonas e quantidade, sem nomes, IDs,
imagens ou ordem de cartas privadas. O cliente consulta essa visão a cada
segundo; não foi criado stream de partidas nem WebSocket.
