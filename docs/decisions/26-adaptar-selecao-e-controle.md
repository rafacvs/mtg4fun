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

1. **API de seleção/movimento — concluída:** aceitar `cardIds` na ação `position`, mantendo
   `cardId` individual; validar a seleção inteira antes de alterar posições,
   respeitar limites/pilhas, preservar deslocamentos, transação, log e retry.
   Adaptar a validação de movimento em `zone_transitions.go`, preservando
   `placeCards` e as regras atuais de fichas/cópias e limpeza de estados.
2. **Interação de seleção — concluída:** retângulo no desktop e modo explícito por toque,
   destaque/limpeza e movimento sem vínculo permanente. Usar a geometria
   renderizada atual (zoom, rotação e pilhas), barra de ações e paleta atuais.
   Validar HTTP/reinício e navegador antes de integrar a próxima funcionalidade.
3. **Transferência de controle — concluída:** acrescentar `transfer_control`, `cardId` e
   `controllerId` no endpoint existente; mover para o campo do participante
   escolhido sem alterar dono, transferir permissões, devolver a zona explícita
   do dono ao sair do campo e preservar privacidade, idempotência e persistência.
   Acrescentar controles ao detalhe atual, mantendo revelação, retry e prévias.
4. **Regressão conjunta — validada:** testar seleção de cartas próprias e recebidas,
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

## Validação intermediária: task 3 e integração das funcionalidades

Em 18/10/2026, a transferência foi adaptada em seguida à seleção. O módulo
`control.go` mantém a ação de transferência; o retorno de cartas passa por
`zone_transitions.go` e `placeCards`, incluindo remoção de fichas/cópias e
limpeza de estados. O detalhe atual mantém revelação, erro/retry e prévias;
`CardControlTransfer` guarda as escolhas locais sem reiniciá-las a cada polling.

Passaram build/TypeScript, testes de `internal/rooms` e as integrações HTTP
`TestTransferControlKeepsOwnerAndReturnsCardsToOwnerZones`,
`TestCollectivePositionIsAtomicAndSurvivesRestart` e
`TestTransferredSelectionPreservesZoneRulesAndRollsBack`. O último verifica
seleção de donos diferentes, rollback real por falha de INSERT no MySQL,
reenvio da transferência/posição, reinício, retorno de cada carta ao dono,
limpeza de estados, remoção de fichas/cópias, privacidade e ordem de topo/fundo.

O fluxo de transferência passou em desktop e celular horizontal com a API
real, incluindo escolha persistente de terceiro participante, seleção/movimento
conjunto de cartas próprias e recebidas, limpeza da seleção quando o controle
muda por polling, arraste bloqueado até escolha explícita e retorno ao dono.
O teste antigo precisou abrir o registro, que agora começa recolhido no celular,
e usar eventos reais de toque no arraste. Captura do detalhe no celular foi
revisada com a paleta atual. A regressão completa segue na task 4.

## Regressão e revisão final (task 4)

Em 18/10/2026, passaram `go -C api test ./... -count=1` com MySQL
isolado, `go -C api vet ./...`, build/TypeScript, os três testes unitários do
frontend e a regressão completa `npm test --prefix app -- --workers=3`:
**73 passaram e 29 foram omitidos** pelos critérios existentes de orientação,
mouse e opt-in. Incluem acesso, login animado/fallback/movimento reduzido,
decks, seis jogadores, prévias, estados, consultas, fichas, contadores,
encerramento, seleção e transferência. Os dados locais não foram usados.

Na revisão posterior à regressão, um teste novo reproduziu a inversão da
pilha quando a carta de cima era a âncora do arraste coletivo. O reposicionamento
agora preserva a ordem anterior entre as selecionadas. A transferência também
procura uma posição livre, evitando inserir uma quarta carta numa pilha cheia.
Após essas correções passaram novamente os testes do módulo de salas, `go vet`,
as três integrações HTTP de seleção/transferência e quatro fluxos de navegador
(posicionamento e transferência, desktop/celular horizontal). O fluxo de
posicionamento verifica a ordem visual da pilha movida pela carta de cima.
A execução final de desktop também passou com retângulo sobre carta virada,
zoom e limpeza da seleção por Escape, com captura revisada.

As capturas de seleção e detalhe da carta foram revisadas; a paleta global,
o login e o lockfile permanecem os da master usada como base. Os controles
novos usam as variáveis e a barra/detalhe atuais. Links locais e
`git diff --check` foram conferidos. Sem novas dependências ou migrations.
O aviso de tamanho do chunk Three.js já existente permanece no build.

Não foi executado o smoke operacional Docker de produção nem a verificação
opt-in do provedor de imagens; não houve alterações nesses componentes.

## Revisão da posição dos comandos

Na revisão local, o usuário pediu explicitamente: **“quero que todos esses
fiquem dentro de ações, +selecionar cartas+, +passar turno+, +grimorio+”**.
Esses três comandos passam ao painel **Ações**. **Passar turno** substitui o
nome **Avançar turno** no menu existente, mantendo a ação e o atalho N.
**Selecionar cartas** ativa/desativa o modo e fecha o painel para permitir
selecionar no campo; **Limpar seleção** também fica nesse painel. **Grimório**
abre a consulta e fecha as ações. Os controles rápidos de comprar e desvirar,
as cores, o acesso pelo desenho do grimório e os atalhos permanecem.

Essa solicitação atualiza a posição dos comandos descrita nos registros
históricos dos ajustes da mesa e desta adaptação. Não altera contratos HTTP,
regras, persistência ou dependências. As verificações anteriores permanecem
históricas.

Nesta revisão passaram build/TypeScript e 27 fluxos de navegador em desktop e
celular horizontal; um cenário de hover foi omitido no perfil de toque pelo
critério existente. O conjunto cobre posicionamento/seleção, transferência,
grimório, ajustes da mesa e salas. As duas verificações de retomada da consulta
precisaram ser atualizadas para abrir **Ações** antes de procurar **Consulta em
andamento**, e passaram na repetição. O fluxo de posicionamento verifica que os
três comandos estão no painel e ausentes da barra rápida. `git diff --check`
passou e o frontend local retornou HTTP 200. Não foram repetidas as suítes Go,
pois esta revisão altera apenas apresentação e navegação do frontend.

As alterações desta revisão permanecem locais na branch de adaptação para
os testes manuais solicitados pelo usuário, sem novo commit, PR ou merge.

O trecho acima registra a etapa intermediária. A revisão posterior removeu
os controles de seleção por clique/toque e acrescentou limpeza pelo espaço
vazio e duplo clique coletivo. Consulte o [estado preparado para publicação](27-duplo-clique-na-selecao.md#revisão-para-publicação),
incluindo as limitações atuais e as verificações desta entrega.
