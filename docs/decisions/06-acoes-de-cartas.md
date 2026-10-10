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
mesma aprovação contempla rolagens e alteração de turno na issue 15; esta
implementação da issue 06 entrega somente compra e movimento de cartas.

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

## Correção da experiência da mesa

Ao revisar a entrega, o usuário relatou que conseguia comprar, mas não mover
cartas, e explicitou que o lobby deve listar salas e permitir entrar numa
tela própria da sala, com ID na URL e mesas/zonas conforme a spec de interface.
Essa solicitação autoriza trazer à issue 06 a navegação e o layout de mesas
descritos na [spec 02](../specs/02-mesa-e-interface.md). Não declara concluídas
as demais entregas das issues 07–09.

A URL `/#/salas/{id}` reutiliza a navegação por fragmento já existente para
lobby/decks, sem nova biblioteca nem contrato HTTP. A sala exibe preparação
antes do início e a mesa depois. Links diretos, recarga e histórico recuperam
a mesma sala. O lobby mantém somente listagem, criação e entrada.

A mesa desenha campo, grimório, cemitério, exílio e comando de cada jogador,
com mão própria e ações na faixa inferior. Desktop permite visão conjunta e
ampliação; celular horizontal usa foco e miniaturas à direita. Vertical cobre
somente a partida com orientação para girar, preservando polling e estado.
Foco é local e não altera permissões ou mão própria. Cartas são representadas
por nome; arraste/posicionamento e seleção múltipla continuam nas issues 08/09.

O antigo botão genérico de retorno ao grimório omitia `libraryPlacement` e
era recusado pela API. Agora topo e fundo são controles explícitos válidos.
Falha de ação preserva a mesa e seleção, com mensagem para tentar novamente.
Uma ação em andamento bloqueia novos envios locais; leituras anteriores à
ação não substituem a confirmação mais recente. Polling volta a tentar após
falhas de leitura.
