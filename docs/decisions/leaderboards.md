# Leaderboard — 03/11/2026

## Aprovação explícita

O usuário solicitou a [página](../issues/leaderboards.md) baseada no HTML
fornecido, na porta 8080, com estatísticas engraçadas de dano e tempo de turno,
aproveitando dados existentes e destacando agiotagem como o mais omisso.

Antes da implementação, foi consultado sobre a semântica dos dados existentes.
Respondeu **“Aprovo essas regras”** à proposta: dano soma reduções de vida,
incluindo pagamentos; tempo soma turnos já passados, incluindo desconexões;
vitória exige partida encerrada com exatamente um jogador acima de zero;
partidas sem vencedor claro não recebem resultado. Também aprovou calcular
dos registros existentes, sem mudar banco ou ações do jogo.

## Implementação

- Branch `feat/leaderboards`, partindo do PR #120 (`cedc882`), ainda aberto.
  Alterações locais anteriores do usuário foram preservadas e excluídas do commit.
- `GET /api/leaderboards?period=all|month|week` exige a sessão já existente.
  Usa transação somente de leitura, com snapshot consistente, sobre MySQL.
  A resposta contém somente nomes públicos, IDs e agregados; não contém
  credenciais, cartas, decks ou snapshots. Sem migration ou dependência nova.
- Mês e semana selecionam partidas iniciadas no período, pelo calendário de
  Brasília; semana começa na segunda-feira. Isso mantém o mesmo conjunto de
  partidas para numeradores e denominadores. Desde sempre inclui o histórico.
- Ranking por vitórias; desempate por participações e ID. Aproveitamento usa
  apenas partidas com resultado definido. Sequências seguem a ordem de
  encerramento; partidas sem resultado não interrompem a sequência. HP médio
  usa a vida final do vencedor. Partidas em andamento não produzem vitórias.
- Vida perdida/recuperada é reconstruída dos ajustes públicos de vida e da
  vida inicial. Não se atribui atacante nem causa de dano que não foi registrada.
- Tempo é atribuído ao dono do turno, mesmo quando outra pessoa passa a vez.
  Considera correções, pula jogadores sem vida e soma somente intervalos
  encerrados por mudança de turno. O primeiro intervalo começa na criação da
  partida ou na última confirmação de mão, quando houver. Não usa relógio do
  navegador nem inventa duração para o turno ainda em andamento.
- Outros troféus: aumentos de vida, ação Comprar, fichas criadas, rolagens e
  mulligans. Mão inicial e preparação não contam como compras; eventos antigos
  sem `drawCount` usam o estado de confirmação da mão reconstruído do log.
  Empates nos troféus usam o ID. Sem eventos elegíveis, o troféu fica vago.
- Agiotagem é homenagem fixa identificada na interface, solicitada pelo usuário,
  sem criar conta nem gravar ausência como estatística. O botão de provocação
  copia texto; em navegador sem clipboard, apresenta a mensagem para cópia manual.
- Composição do HTML preservada com fontes/paleta/cabeçalho existentes.
  Navegação usa duas colunas no celular e sai do cabeçalho nas larguras
  intermediárias para acomodar a quarta página. Classificação compacta no
  celular; pódio coloca o primeiro lugar antes dos demais.

## Validação

Em 03/11/2026: build/TypeScript e `go vet ./...` passaram. Integração
`TestLeaderboards*` passou com MySQL descartável: permissão, método/período
inválidos, cálculos, reenvio idempotente, tempo atribuído ao dono do turno,
correção de turno, persistência após reinício, filtragem, dados privados,
ausência de vencedor e compras na preparação, inclusive eventos legados.
Teste unitário cobre a virada de mês/semana no calendário de Brasília.

Seis fluxos de navegador passaram com API/MySQL reais nos três projetos:
desktop, celular vertical e horizontal. Cobrem três partidas com vencedores,
pódio/classificação/troféus, filtros, recarga, voltar, homenagem, provocação,
larguras de 320 a 1440 px e recuperação de erro. Somente a falha visual usa
interceptação; a recuperação volta à API real. Capturas desktop e 320 px
foram inspecionadas. Sem execução da suíte completa da aplicação.
