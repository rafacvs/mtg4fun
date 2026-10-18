# Adaptação dos PRs 23 e 24 à mesa atual

## Autorização e escopo

Em 18/10/2026, após a análise dos conflitos, o usuário solicitou quebrar os
PRs [23](https://github.com/rafacvs/mtg4fun/pull/23) e
[24](https://github.com/rafacvs/mtg4fun/pull/24) em tasks e adaptar as duas
funcionalidades em uma branch nova, integrando uma por vez e mantendo o design
mais recente. A branch é `work/adaptar-selecao-e-controle`, baseada na master
após os merges dos PRs 26 e 27. Os PRs antigos e suas branches são preservados.

O pedido autoriza a seleção/reposicionamento coletivo da
[issue 09](../issues/09-selecionar-e-mover-varias-cartas.md) e a transferência
de controle da [issue 14](../issues/14-transferir-controle.md), incluindo as
extensões aditivas do endpoint de ações descritas abaixo. Não cria ações
coletivas adicionais ou transferência para zonas privadas de outro jogador.

## Tasks, executadas em sequência

1. **API de seleção/movimento:** aceitar `cardIds` na ação `position`, mantendo
   `cardId` individual; validar a seleção inteira antes de alterar posições,
   respeitar limites/pilhas, preservar deslocamentos, transação, log e retry.
   Adaptar a validação de movimento em `zone_transitions.go`, preservando
   `placeCards` e as regras atuais de fichas/cópias e limpeza de estados.
2. **Interação de seleção:** retângulo no desktop e modo explícito por toque,
   destaque/limpeza e movimento sem vínculo permanente. Usar a geometria
   renderizada atual (zoom, rotação e pilhas), barra de ações e paleta atuais.
   Validar HTTP/reinício e navegador antes de integrar a próxima funcionalidade.
3. **Transferência de controle:** acrescentar `transfer_control`, `cardId` e
   `controllerId` no endpoint existente; mover para o campo do participante
   escolhido sem alterar dono, transferir permissões, devolver a zona explícita
   do dono ao sair do campo e preservar privacidade, idempotência e persistência.
   Acrescentar controles ao detalhe atual, mantendo revelação, retry e prévias.
4. **Regressão conjunta:** testar seleção de cartas próprias e recebidas,
   perda de controle durante seleção, retorno ao dono, fichas/cópias, estados,
   log, reinício e fluxos existentes. Conferir design por capturas e publicar
   novo PR contra master com os resultados efetivamente executados.

## Compatibilidade e apresentação

Sem migrations, dependências ou troca de transporte. Reutilizar as aprovações
de [ações HTTP](06-acoes-de-cartas.md), os
[ajustes da mesa](22-ajustes-da-mesa.md), a
[prévia lateral](23-previa-lateral-de-cartas.md) e a
[paleta/login](25-paleta-e-login-visual.md). Resultados históricos dos PRs
originais não validam esta adaptação; as novas verificações serão registradas
após sua execução.

## Validação intermediária: tasks 1 e 2

Em 18/10/2026, antes de adaptar a transferência: testes de `internal/rooms`,
build/TypeScript e integração HTTP `TestCollectivePositionIsAtomicAndSurvivesRestart`
passaram. Esta integração verifica seleção inválida/duplicada, limite de posição,
compatibilidade individual, reenvio, log e recuperação após reinício com MySQL real.
O fluxo `posicionamento.spec.ts` passou em desktop e celular horizontal, incluindo
seleção, deslocamento coletivo, manipulação individual posterior e retângulo com
zoom no desktop. A captura de seleção foi revisada com a paleta atual.

Durante a adaptação, as primeiras tentativas de desktop usavam coordenadas
absolutas anteriores ao scroll e procuravam cantos fora da área visível. O teste
passou a verificar a posição individual também pela API real e a exercitar o
retângulo em viewport desktop com zoom. Esses resultados não são aprovação da
regressão conjunta, que pertence à task 4.
