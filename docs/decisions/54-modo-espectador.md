# Modo espectador

Substitui, para partidas em andamento, a exclusão de espectadores nas
[specs](../specs/README.md#fora-da-primeira-versão).

## Aprovação explícita

Em 31/10/2026, o usuário pediu em conversa, sem worktree, um modo em que a pessoa entra na
mesa e consegue acompanhar, sem nenhuma ação “por enquanto”. Depois definiu: “ele pode ver
o campo, pode ver a mão dos oponentes, as cartas são viradas para ele”, e deixou a solução
visual para a implementação: “acha aí uma solução visual […] que fica bom para ele conseguir
consultar a mão, mas ele não pode ter ações dentro do jogo”.

## Comportamento

- `GET /api/rooms/{id}/match` responde a qualquer usuário autenticado enquanto a partida
  estiver em andamento. Para quem não joga, a resposta traz a mão de todos, com identidade e
  modificadores. Jogadores continuam recebendo só a própria mão.
- As ações continuam exigindo participação: quem assiste recebe 404 em
  `POST /match/actions` e 409 ao tentar entrar na sala, porque os participantes seguem fixos.
- No lobby, “Partida fechada” deu lugar a “Assistir”. A tela usa a mesa de sempre, com uma
  barra inferior própria: uma aba por jogador, com a quantidade de cartas e a marca de quem
  está na vez. Escolher a aba abre a mão dele e o coloca no lugar principal da mesa, como se
  a pessoa estivesse atrás da cadeira dele.

## Escolhas de implementação, não pedidas literalmente

- Qualquer usuário autenticado pode assistir, sem convite nem aviso aos jogadores, como
  acontece com a entrada em salas. Uma segunda conta pode ver as mãos do oponente: é uma
  limitação aceita por enquanto para um projeto entre amigos.
- Só a mão foi aberta. Grimório, consulta do grimório e carta virada para baixo no campo
  continuam ocultos, e o registro não passa a nomear cartas compradas.
- Só dá para assistir com a partida em andamento. Na preparação continua valendo a entrada
  na sala. Na definição da ordem aparece um aviso, e a mesa abre sozinha ao terminar. Partida
  encerrada volta a responder 404 para quem não jogou, e quem assistia volta ao lobby.
- Assistir não grava nada no banco: a pessoa lê a partida a cada segundo, como os jogadores, e não
  aparece em nenhuma lista. O uso do WebSocket mudou; veja a seção seguinte.
- A primeira aba é o primeiro da ordem de turnos. A mesa não muda sozinha a cada turno, para
  as cartas não trocarem de lugar enquanto a pessoa lê.

## Emojis para quem assiste em 01/11/2026

O usuário pediu em conversa: “o espectador ele vai conectar também com o WebSocket, ele pode ver os
emojis, ele pode mandar também”. Isso substitui, só para os emojis, a ausência de ações de quem assiste.
Qualquer usuário autenticado conecta em `GET /api/rooms/{id}/live` enquanto a partida estiver em andamento,
recebe e envia emojis com o mesmo limite, e os outros jogos continuam recusando. Antes de a partida começar,
quem não joga continua recebendo 404. O nome de quem assiste aparece embaixo do emoji para todos.

## Verificação em 31/10/2026

Estes resultados comprovam comportamento observado, não aprovam a escolha.

- Integração com executável e MySQL reais (`spectator_test.go`): mão de todos para quem assiste
  e privada entre jogadores, compra ao vivo, grimório e carta virada ocultos, cinco ações
  recusadas sem mudar o estado, entrada recusada e 404 antes de iniciar e depois de encerrar.
- Navegador com API real nas três telas (`espectador.spec.ts`): Assistir no lobby, troca de
  jogador, ausência dos comandos, leitura da carta, atualização ao vivo e volta ao lobby. Os
  atalhos de teclado só foram verificados no desktop. As imagens de mesa com três jogadores
  foram inspecionadas em 1440×895 e nas duas orientações do Pixel 7; a tela de 860×600 foi
  capturada, mas não inspecionada.
- A suíte Go completa só falha em `TestTransferredSelectionPreservesZoneRulesAndRollsBack`,
  igual à `master`. Ela detectou que a busca de fichas tinha ficado aberta para quem assiste,
  o que foi corrigido.
- Oito specs de navegador que passam pelos arquivos alterados, em banco limpo, só no desktop:
  12 falhas, 4 aprovações e 1 pulo, com os mesmos cenários falhando na `master` e nesta branch.
  Um cenário que já falha para antes do fim, então essa comparação não cobre o que viria depois.
  A suíte completa de navegador e o smoke Docker não foram executados.
- `npm run build` não concluiu porque `app/dist` tem arquivo sem permissão de escrita, sem relação
  com esta mudança. O build foi validado com `vite build --outDir` em pasta temporária.

## Saída pelo lobby em 03/11/2026

O usuário pediu a possibilidade de sair da sala no modo espectador e esclareceu:
“sair da sala tem que ser no mesmo lugar que os jogadores normais voltam pro
lobby”. O caminho existente é **Ações → Lobby**. A implementação reutiliza o
link dos jogadores em um menu de navegação do espectador, sem disponibilizar
ações de jogo. A saída volta a `/#/salas`; a desmontagem da mesa interrompe o
polling e encerra o WebSocket existentes. A pessoa continua autenticada e pode
voltar a assistir. Não há alteração de API, banco ou dependências.

Critérios: [saída do espectador](../issues/sair-espectador.md).

Nesta entrega passaram o build/TypeScript e os cenários de navegador em
desktop e nas duas orientações do celular. O fluxo confirma o mesmo link no
menu dos jogadores, a saída manual do espectador, o fechamento do WebSocket,
a igualdade do estado da partida antes/depois e a possibilidade de voltar a
assistir. A adaptação do teste abre Comandos antes de Ações na mesa do jogador
em telas compactas. Não foram repetidos testes Go: a API não foi alterada.
