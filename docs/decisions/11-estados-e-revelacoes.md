# Estados e revelações de cartas

> Ajustes posteriores: [regras e interface da mesa](22-ajustes-da-mesa.md).

Issue: [11](../issues/11-alterar-estados-e-revelar-cartas.md).

## Aprovação explícita

Na conversa de implementação paralela das issues 11–13, foram apresentados os
controles e contratos aditivos no endpoint de ações existente. O usuário
respondeu inicialmente: “ocultar revelar até ocultar explicitamente, mover de
zona nao altera nada” e “ok, faces preservadas no snapshot”. Essa resposta
substitui a duração anterior da revelação do grimório descrita na
[decisão 10](10-interface-do-grimorio.md): devolver/mover uma carta não encerra
sua revelação.

Foi explicado que escolher uma face (lado A/B) e colocar face para baixo são
estados independentes: ocultar e voltar face para cima preserva o lado escolhido.
Na confirmação complementar dos controles/API e da lista pública separada de
cartas reveladas da mão/grimório sem ordem/posição, o usuário respondeu:
“11 ok. DUplo clique em uma carta vira/desvira.” Desvirar todas permanece no
menu de ações, conforme solicitação inicial.

## Implementação

As ações usam o endpoint, UUID/idempotência, polling e transação já aprovados
na [issue 06](06-acoes-de-cartas.md), sem novo transporte ou tabelas:

- `set_tapped`: `cardIds`, `tapped` booleano; apenas cartas controladas no campo.
- `untap_all`: desvira todas as cartas controladas do próprio campo.
- `set_face`: `cardId`, `faceIndex` inteiro dentro das faces preservadas.
- `set_face_down`: `cardIds`, `faceDown` booleano.
- `reveal_cards`: `cardIds`, `revealed` booleano; revelação para todos os
  participantes até ocultar explicitamente. As ações anteriores de revelação
  do grimório continuam válidas, agora com essa mesma duração.

Movimentos, compras e devoluções preservam os estados; não interpretam regras
ou texto de Magic. Mão/grimório permanecem privados, com `exposedCards` separado
para as instâncias explicitamente reveladas, ordenado por ID estável, sem ordem
ou posição do grimório. O dono pode abrir essa carta e ocultar sua revelação.
Ocultar revelação não coloca uma carta pública face para baixo: são controles
independentes.

Cartas face para baixo têm nome/faces/face escolhida omitidos para observadores
que não são dono/controlador, salvo revelação explícita. Logs de estados não
contêm identidade; os nomes já revelados explicitamente continuam no histórico.
A confirmação só acontece após salvar snapshot, log e intenção na transação.

Faces são nomes existentes do catálogo relacionados com `attach="transform"`,
congelados na instância ao iniciar. O catálogo usa `prop.side=back` para pedir
imagem de verso ao provedor já existente. Snapshots antigos continuam legíveis;
instâncias antigas sem faces preservadas não oferecem seleção inventada.

Duplo clique com mouse vira/desvira somente cartas controladas no campo. Toque
e clique simples abrem a consulta com controles explícitos. A carta virada usa
rotação; face para baixo usa verso genérico, distinguindo os estados.

## Verificação operacional histórica

Em 2026-10-12, a requisição real da imagem traseira Scryfall para a impressão
`0650124f-4dbe-450a-bbd1-28b0071c02c5`, com `format=image&face=back`, retornou
HTTP 200, `image/jpeg`, 133342 bytes, após redirecionar para a imagem em
`cards.scryfall.io/large/back/0/6/0650124f-4dbe-450a-bbd1-28b0071c02c5.jpg`.
A disponibilidade externa não faz parte da suíte determinística.
