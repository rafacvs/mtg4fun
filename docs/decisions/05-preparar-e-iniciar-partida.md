# Preparação e início de partidas

Issue: [05](../issues/05-preparar-e-iniciar-partida.md).

## Aprovação explícita

Na implementação da issue, a especificação deixava em aberto o número mínimo
de participantes e não definia os contratos de preparação. Foram apresentadas
as alternativas de mínimo um, dois ou mais jogadores. O usuário aprovou
explicitamente mínimo de **um participante**, permitindo iniciar uma mesa para
teste ou jogo solo sem impor formato de Magic.

O usuário também aprovou estes contratos HTTP: `PUT
/api/rooms/{id}/participants/me/ready` com `{ "deckId": ... }`, `POST
/api/rooms/{id}/start` e `GET /api/rooms/{id}/match`. O SSE já aprovado para
salas continua enviando somente o resumo público de preparação, inclusive
prontidão; não envia deck escolhido, ordem ou conteúdo do grimório.

A vida inicial precisava vir de configuração no banco, mas não havia valor
definido. O usuário aprovou uma linha `initial_life` configurável diretamente
no banco, com padrão **40**. Não foi criado endpoint administrativo para essa
configuração nesta entrega.

## Implementação

O snapshot da sala mantém o deck selecionado apenas no armazenamento e expõe
ao cliente somente se cada participante está pronto. O início cria um snapshot
de partida com instâncias de cartas independentes, dono/controlador, zonas,
vida e resultado do D20. O sorteio repete apenas entre empatados. Snapshot,
log de início e status da sala são gravados na mesma transação antes da
resposta ou da atualização SSE.

O endpoint da partida exige participação e expõe contagens de zonas, vida e
ordem de turno. Conteúdo e ordem dos grimórios não são enviados. Excluir um
deck da biblioteca posterior ao início não altera o snapshot da partida.
