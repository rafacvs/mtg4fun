# Encerrar partida com concordância de metade da sala

Issue: [17](../issues/17-votar-reinicio-encerramento.md).

## Solicitação e aprovação explícita

Em 15/10/2026, o usuário pediu um botão vermelho **Finalizar**, à direita de
**Ocultar prévia**, com confirmação para encerrar a partida e fechar a sala.
Ao ser consultado sobre quem pode finalizar e sobre a unanimidade prevista
originalmente, respondeu: **“qualquer jogador da sala, pelo menos metade da
sala atual deve concordar, se eu estiver sozinho na partida eu posso finalizar
sem problemas”**.

Essa autorização substitui a unanimidade somente para o encerramento. Reinício
e seus demais requisitos permanecem pendentes na issue 17.

## Comportamento e implementação

- Qualquer participante da partida pode abrir **Finalizar** e confirmar sua
  concordância. A confirmação inicial já conta como voto; abrir ou cancelar o
  diálogo não registra voto. O diálogo informa o impacto e o número necessário.
- O limite é metade dos participantes da partida, arredondada para cima:
  1/1, 1/2, 2/3, 2/4, 3/5 e 3/6. Conexões temporárias não alteram participantes
  nem o limite. Um usuário conta uma vez, mesmo com duas abas/reenvios.
- Enquanto faltam votos, a mesa permanece jogável. O botão exibe a contagem e
  um aviso permite aos demais acompanhar/concordar. Concordâncias ficam salvas
  sem expiração; fechar o diálogo não retira uma concordância já confirmada.
- Ao atingir o limite, a partida fica finalizada e a sala encerrada, sai do
  lobby/SSE e não aceita entrada nem novas ações de jogo. Os participantes
  voltam ao lobby; retornar à URL antiga também leva ao lobby.
- Snapshot final, votos e logs ficam preservados no banco. A leitura de
  `GET /api/rooms/{id}/match` continua restrita aos participantes e mantém a
  filtragem privada. Não há exclusão de dados, reabertura ou tela de histórico.

A intenção HTTP usa o fluxo existente
`POST /api/rooms/{id}/match/actions`, com `{ intentId, kind: "finish" }`.
Somente a sessão determina o autor do voto; não aceita indicar outro jogador.
O retorno acrescenta `finished`, `finishVotes` e `finishRequired` à visão da
partida. Snapshots antigos sem esses campos continuam ativos, sem votos.

Ações são serializadas pelo bloqueio transacional do snapshot existente.
O voto final atualiza partida, sala, log de partida, evento de sala e intenção
na mesma transação MySQL. Uma falha não pode fechar apenas a sala nem confirmar
um voto não persistido. Reenviar uma intenção confirmada recupera a visão
atual, inclusive após encerramento; uma intenção nova após o fim recebe 409.
Votar novamente enquanto pendente, com outra intenção, não duplica voto/log.
Não há nova tabela, migration, dependência ou transporte.

## Imagem do grimório

Na mesma conversa, o usuário forneceu a imagem e pediu: **“ali em grimorio,
deve usar essa imagem aqui, ajuste para ficar visualmente bonito”**.
O arquivo original é servido localmente como `app/public/library-back.png`.
O grimório usa três camadas com cantos arredondados, sombra e deslocamento
discreto, preservando a proporção das cartas. Clique/duplo clique continuam
abrindo ações/comprando; não há consulta a outro provedor de imagens.

O usuário também pediu remover a mensagem **“Uma carta comprada.”** por ser
desnecessária. A compra rápida deixa de mostrar esse aviso; mão e registro
continuam atualizando normalmente.

## Verificação

Em 15/10/2026:

- `go -C api vet ./...` e `go -C api test ./... -count=1`: passaram,
  incluindo integração HTTP/executável com MySQL descartável. Os novos testes
  cobrem de um a seis participantes, início por quem não é criador, sessão e
  participação, um voto por jogador, concorrência, reenvio, recuperação após
  reinício, continuidade da mesa enquanto pendente, fechamento da sala,
  preservação do estado/log e rejeição de novas ações. Revogar a permissão de
  gravar o log final comprova rollback da sala e da partida na mesma transação.
- `npm run build --prefix app` e `npm run test:unit --prefix app`: passaram,
  incluindo TypeScript e os três testes unitários existentes.
- `npm test --prefix app -- --workers=3`: 60 passaram e 27 foram omitidos
  pelos critérios de orientação/mouse e opt-in. Os novos fluxos em desktop e
  celular horizontal cobrem confirmação/cancelamento/Escape, encerramento solo,
  concordâncias de dois entre três jogadores, recuperação por recarga,
  desconexão, retorno dos demais ao lobby e URL da sala encerrada.
- O navegador carregou a imagem real do grimório e verificou proporção,
  posição/cor do botão e ausência do aviso de compra, exercitando a API real.
  As capturas desktop/celular foram conferidas.
- Links locais e `git diff --check`: conferidos. Ambiente Docker local:
  Air recompilou, frontend e imagem retornaram HTTP 200.

Não foi executada a suíte operacional Docker de produção. Os testes usam
bancos descartáveis; não encerram salas nem alteram contas do ambiente local.
