# Correção dos acertos na queda de braço — 03/11/2026

## Relato e aprovação explícita

O usuário relatou que o amigo via “×” e zero pontos em todos os acertos, com
ambos no computador. Pediu investigar outras causas antes de mudar a
sincronização. A [investigação](../issues/queda-de-braco-acertos.md) não encontrou
dependência de dono/convidado ou controle de entrada nos cenários normais,
mas reproduziu acerto visual virando zero com relógio diferente e com atraso.
Isso não comprova as condições exatas do computador do amigo.

Depois de explicar impactos e alternativas, o usuário confirmou explicitamente:
**“Sim, as duas só no minigame”**, autorizando sincronização com horário do
servidor e compensação visual do envio. Pediu restringir a correção ao minigame.

## Implementação

- Somente módulos da queda de braço, seus testes e documentação. Sem mudanças
  no transporte compartilhado, banco, dependências, partidas ou leaderboard.
- A mensagem aditiva `arm-sync`, no canal existente `coin-duel`, exige que o
  usuário esteja numa queda de braço aceita. Reutiliza o limite de mensagens
  já existente. Responde com `arm-clock` contendo ID do solicitante, nonce
  limitado a 64 bytes e horário do servidor em milissegundos. O cliente só
  aceita a amostra associada ao próprio ID e ao nonce pendente.
- A consulta de horário não começa o jogo, altera prontidão, consome tentativa
  ou renova o prazo do duelo. O canal compartilha apenas esse horário público;
  os demais consumidores ignoram a mensagem. Clientes antigos continuam
  podendo usar as mensagens anteriores.
- Amostra inicial ao abrir/reconectar, renovada a cada cinco segundos enquanto
  a queda de braço está aberta. A animação usa `performance.now()` e o horário
  do servidor, sem depender de `Date.now()` do computador.
- O tempo do servidor é estimado com metade da ida e volta da amostra. O
  ponteiro antecipa mais metade da ida e volta para representar a posição
  esperada na chegada do clique. Amostras recentes menos congestionadas têm
  preferência; amostras antigas são renovadas para acompanhar mudança de rota.
- Contagem regressiva e bloqueio usam o tempo estimado atual, sem antecipar
  o envio antes de começar. Enquanto sincroniza, a tela informa isso e bloqueia
  Começar/Acertar/espaço. Recarga/reconexão recalibra o relógio.
- O ponteiro é atualizado diretamente no SVG a cada frame, evitando atraso de
  uma renderização do React nas faixas estreitas. Ao completar as tentativas,
  congela imediatamente no instante confirmado pelo servidor.
- Servidor segue avaliando no instante de chegada, sem aceitar horário, ângulo
  ou pontuação do navegador. Faixas, pontos, tentativas, erros, volta perdida,
  Fase Maluco e desistência permanecem com as regras aprovadas anteriormente.
- Compensação é estimativa: assimetria e variações imprevisíveis da conexão
  continuam podendo afetar zonas estreitas.

## Verificação

Antes da correção, os testes de navegador reproduziram vermelho virar zero
para o convidado com diferença de um segundo e com atraso controlado de
120 ms em cada direção. Foram exercitados dois jogadores e as quatro cores,
com convite invertido, por relógio, botão e espaço, nas condições normais.

Após a correção, três testes unitários do relógio e a integração
`TestArmClockSamplesRequireOwnArmDuelAndDoNotConsumeAttempts` passaram. A
integração usa WebSocket/API/MySQL reais, confere os dois solicitantes,
recusa de terceiro, payload inválido e ausência de alteração de prontidão ou
início. Build/TypeScript e `go vet ./...` passaram.

A rodada final dos 21 cenários da queda de braço passou em desktop e nas duas
orientações de celular: acertos reais dos dois jogadores, quatro cores,
relógio/botão/espaço, convite invertido, recarga, parada, erro/volta perdida,
resultado/desistência, diferença de relógio de um segundo, alteração do relógio
durante o jogo e atraso de 120 ms em cada direção. A versão intermediária
revelou atraso de frame e observação estreita demais no teste; a rodada final
usa o ponteiro atualizado diretamente e observa a faixa real a cada 5 ms,
sem fabricar pontuação.

A regressão dos demais minigames passou nos 13 cenários aplicáveis de Cara ou
coroa, emojis e dados; dois casos de dimensões do dado são exclusivos de
desktop e foram ignorados nos projetos móveis. Go com `-race` nos módulos
minigames/live passou. Os 41 testes unitários existentes do frontend passaram.
O build e a integração do relógio também passaram no checkout isolado sobre
a master, sem depender dos PRs anteriores. O patch de código é idêntico ao
revisado nas duas frentes (padrões e requisitos), sem bloqueios encontrados.

O PR da correção parte diretamente da master e contém apenas o minigame,
seus testes e documentação. O ambiente principal preserva as entregas
anteriores e continua na porta 8080. A suíte completa da aplicação não foi
executada.
