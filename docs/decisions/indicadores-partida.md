# Indicadores de partida

## Aprovação explícita

Em 03/11/2026, o usuário pediu os três indicadores com imagens de referência
para a crônica e o trilho lateral. Após consulta sobre regras e extensão aditiva
da API, confirmou: Q1 “Mostrar sala e partida”; Q2 “Sim, compras e terrenos no
turno”; Q3 “isso mostrar por jogador no turno, cada turno tem que mostrar um
novo, pois as vezes esquecemos se baixamos terrenos/comprarmos cartas”. Pediu
branch nova e ambiente na porta 8080. Branch: `feat/indicadores-partida`.

A confirmação autoriza os tempos persistidos e contadores por jogador/turno,
sem mudar comandos existentes, dependências, banco ou transporte.

## Implementação

- A resposta de partida acrescenta `roomCreatedAt`, `startedAt`, `finishedAt`
  quando disponíveis. Os horários vêm dos eventos existentes de
  criação, início e encerramento no MySQL. Não há migration nem reinício do
  relógio ao recarregar. O relógio do navegador avança a partir do horário do
  servidor recebido no cabeçalho HTTP `Date`; ao encerrar, usa o horário final.
  O horário atual não é acrescentado ao corpo, preservando igualdade de
  respostas sem mudança de estado e em reenvios idempotentes.
- `players[].landCount` conta instâncias de cartas do tipo Land no campo
  daquele controlador, conforme a face selecionada e a identidade autorizada
  ao observador. Cartas viradas e empilhadas contam individualmente; terrenos
  saem da contagem ao deixar o campo e acompanham transferências de controle.
  Identidades ocultas não são reveladas por esse número.
- Eventos novos de compra guardam `drawCount`: quantidade comprada pela ação
  Comprar depois do mulligan. Compras na preparação são registradas com zero;
  mão inicial, mulligan, consultas e movimentos genéricos não são compras.
- Eventos novos de movimento da mão para o campo guardam `landPlays`: número
  de terrenos de identidade pública no momento do movimento. Reposicionamento,
  reanimação, busca direta para o campo e transferência não somam. Retornar à
  mão e jogar de novo registra uma nova entrada. É acompanhamento manual,
  sem impor limite de terrenos ou regras de Magic.
- Os dados ficam no payload dos eventos, na transação existente e protegidos
  pelo `intentId`. Cada mudança de turno abre um novo resumo (inclusive a
  correção para o jogador anterior); não desfaz ações nem resumos históricos.
  Todas as pessoas da partida aparecem em cada resumo, inclusive com zero.
- Resumos são calculados antes dos filtros da crônica. Eventos consecutivos
  agrupados somam os contadores. Turnos antigos podem ser expandidos.
- Partidas existentes reaproveitam horários e compras registrados. Movimentos
  antigos não contêm a classificação histórica de terrenos: o resumo mostra
  “—” quando essa informação não pode ser reconstruída com segurança.

Na revisão visual, o usuário pediu uma aba específica “terrenos/draws”. A
crônica acrescenta **Terrenos / Draws** na mesma faixa de **Jogo**, **Ajustes**
e **Tudo**, antes de **Jogo** e na mesma linha, conforme a correção explícita do usuário. Os resumos aparecem
somente nessa opção. Os dois relógios continuam no cabeçalho.

O escopo corresponde à [entrega](../issues/indicadores-partida.md). Verificações em 03/11/2026:

- Build/TypeScript e `go vet ./...` passaram; 41 testes unitários do frontend
  passaram.
- A integração `TestMatchIndicatorsPersistAndRespectVisibility` passou,
  incluindo tempos persistidos, reenvio, tipos mistos, cartas viradas,
  transferência, visibilidade de cartas ocultas e reinício.
- Os fluxos de indicadores e de crônica passaram em desktop e nas duas
  orientações de celular (nove cenários). Cobrem agrupamento, mudança de turno,
  histórico, filtros, recarga e relógio em andamento. Capturas foram revisadas.
- O usuário confirmou manualmente que o contador lateral de terrenos funciona.
- A regressão Go completa terminou com uma falha de posicionamento em
  `TestTransferredSelectionPreservesZoneRulesAndRollsBack`: espera coluna 520,
  mas ambas as cartas estão na coluna 400. A mesma falha foi reproduzida numa
  cópia isolada do commit base `7b9c8b9`, sem os indicadores. Não foi alterada
  neste escopo. Os demais testes dessa execução passaram.
- Sem migration, novas dependências ou alteração dos dados locais de teste do
  usuário. Os testes usaram bancos descartáveis. O ambiente dev foi mantido
  na porta 8080.
