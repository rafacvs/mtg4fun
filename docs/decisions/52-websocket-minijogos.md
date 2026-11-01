# WebSocket genérico para jogos efêmeros da sala

Relaciona-se à [decisão de SSE para salas](03-salas-sse.md) e à
[preparação com dados 3D](preparacao-dados-3d.md).

## Contexto

O usuário relatou que, ao voltar para o navegador, todos os dados atirados pelos outros
saíam de uma vez, e pediu um mecanismo genérico de WebSocket para jogos que não precisam
de histórico salvo. A leitura do código mostrou duas causas: em aba oculta o polling
continuava lançando dados em um motor parado por `requestAnimationFrame`, e ao reabrir a
página a decisão de animar comparava o relógio do cliente com o do servidor. O problema
foi deduzido do código, não reproduzido antes da correção. Trocar só o transporte não o
resolveria, por isso a regra de animação também mudou.

## Aprovação explícita

Em 31/10/2026, depois de receber a arquitetura, as alternativas e os impactos, o usuário
respondeu em conversa:

- Biblioteca: “pode ser esse Coder aí”, ou seja, `github.com/coder/websocket`, em vez de
  `gorilla/websocket`.
- Rolagens de brincadeira: “pode ser só em memória, não tem problema”.
- X1: cada um escolhe e confirma, e confirmar pode ser desfeito. Quem confirma antes fica
  com o lado, e o outro não pode selecioná-lo. Se os dois confirmarem o mesmo lado ao mesmo
  tempo, o servidor não sorteia, aparece um aviso e um deles desconfirma e troca.
- Lugar: X1 e emojis só na preparação, antes de iniciar; não na etapa de definir o turno.
- Registro: “é específico para esses joguinhos”. O transporte da partida continua em aberto
  e a lista de salas continua em SSE.

A arquitetura abaixo foi apresentada nessa consulta e aprovada com essa resposta. O pedido
original do usuário define dados por WebSocket com o comportamento atual, X1 com resultado
no meio da tela para todos e barra de emojis estilo Meet, com queda e cooldown.

## Arquitetura

- `GET /api/rooms/{id}/live`: uma conexão por aba, só para participantes (401/404). O
  handshake confere a origem, porque a proteção HTTP de origem não cobre GET. A sessão é
  revalidada a cada 10 s; ao terminar, a conexão fecha com o código 4401 e o cliente não
  reconecta.
- `api/internal/live`: hub em memória, sem regra de jogo. Cada jogo se registra com nome,
  limite, `Snapshot` e `Handle`. Mensagens: `{game, type, id, data}`; o servidor responde
  `ack` ou `error` para o `id` recebido.
- Sem histórico: ao conectar chega só o `snapshot` de cada jogo. `state` traz sempre o
  estado completo. Cliente que não acompanha é desconectado e volta com um novo estado.
- O limite é por pessoa e por jogo, somando todas as abas.
- `app/src/features/live`: reconexão com espera crescente e `useLiveChannel(jogo, handler)`.
- Limitação: o hub assume um único processo da API, como hoje. Várias instâncias exigiriam
  um broker. Reiniciar a API perde duelos e brincadeiras; os clientes reconectam sozinhos.

Nginx e Vite encaminham o upgrade dessa rota. Não há tabela, migration nem serviço novo.

## Jogos

- **Dados (`dice`):** o envio continua em `POST /preparation/actions`. Rolagens que valem
  continuam em MySQL, na mesma transação. Brincadeiras ficam em memória, até 50 por sala,
  com idempotência e o limite de cinco por segundo, e somem ao reiniciar a API. Só o que
  chega ao vivo com a aba visível é animado; o restante entra direto no registro.
  `GET /preparation` continua disponível, mas o cliente não o consulta periodicamente.
- **X1 (`coin-duel`):** segue as regras aprovadas acima, com sorteio no servidor.
- **Emojis (`emoji`):** lista fixa no servidor.

## Escolhas de implementação, não pedidas literalmente

- X1: desafiar pede uma confirmação; o desafio abre direto para o adversário, que pode
  recusar. Uma pessoa joga um X1 por vez, e outras duplas podem jogar ao mesmo tempo. Sem
  nenhuma ação por 60 s, expira. Quem fica 15 s sem conexão perde o X1, o que preserva um
  F5. O painel só fecha por decisão explícita. Iniciar a partida cancela os X1 em andamento.
- Emojis: nome de quem enviou abaixo do emoji.
- Aba oculta não acumula resultado de X1 nem emoji para mostrar na volta.

## Telas do designer e regras novas em 31/10/2026

Depois de testar o MVP, o usuário enviou as telas do designer e pediu paridade visual
idêntica na tela da sala (“as imagens”), com capturas no Chromium antes de cada tela.
Pediu explicitamente: emoji ao lado de Rolar d20, ignorar por enquanto o botão de confete,
menu no assento, convite como notificação com aceitar e recusar, tela de jogo nova, ver em
tempo real o que o outro escolheu, novo resultado e dado proporcional à mesa.

Isso substitui, nas regras acima: o desafio que abria direto, a escolha privada até confirmar
e o aviso por confirmação simultânea, o painel do menu de ações e o botão de emoji no canto.
O bloqueio do lado confirmado e o desconfirmar continuam. O conflito agora vem das escolhas:
com o mesmo lado, ninguém confirma; o servidor também recusa.

Vieram do texto e das imagens do design, e não de um pedido à parte:

- “Quem perder fica marcado na mesa até a partida começar. Quem recusar também.” A marca e o
  registro do X1 ficam em memória, como o resto, e somem ao iniciar a partida ou reiniciar a API.
- “Arregar (conta como derrota)”, depois de aceitar.
- Selo “Brincadeira” e histórico com tempo relativo. O selo tinha sido retirado antes a pedido
  do usuário; voltou porque está no design novo.
- Lista de emojis 😂 💀 🔥 😭 🐷 👀 🐐 🍅 e o aviso “Calma… 3s”, lidos da imagem.

Escolhas de implementação, sem referência no design: a mensagem de quem chamou enquanto espera
a resposta, com Cancelar sem marca; o estado inicial da tela do X1 e o rótulo “Confirmar”; os
textos de quem recusou ou arregou (“Nem precisou de moeda.”, “Recusou o X1”); quem perde a conexão
ou deixa expirar não fica marcado. A paisagem do assento vem da cor do comandante, ou da primeira
carta (preto, azul, vermelho e o restante verde), porque o design usa paisagens, e não a carta.
O rótulo “Aconchegaz” foi mantido, embora a imagem pareça dizer “Aconchegante”, porque foi nomeado
em decisão anterior. A descrição do Mulligan saiu do cartão e ficou como dica ao passar o mouse.

Depois de ver na porta 8080, o usuário pediu dois ajustes que substituem o que está acima: “pode
deixar spamar, só que a cada clique o cooldown vai aumentando um pouco”, e a bandeja “na lateral do
ícone, da direita para a esquerda ali no espaço livre”, sem balão por cima. Escolhas de implementação:
a espera começa em 200 ms, cresce 35% por clique até 3 s e zera depois de 5 s de pausa, no servidor,
por pessoa. O aviso “Calma…” e o bloqueio visível só aparecem em esperas a partir de cerca de 0,7 s. No
celular o botão fica à esquerda, então a bandeja abre para a direita, sobre Rolar d20.

O raio do dado acompanha o raio do feltro, com mínimo de 9 px; a física já escalava com a mesa.

## Verificação em 31/10/2026

Estes resultados comprovam comportamento observado, não aprovam a arquitetura.

- Integração com executável e MySQL reais (`live_test.go`): handshake sem sessão, fora da
  sala, sala inexistente e origem cruzada; rolagem chegando à sala; reconexão sem replay;
  brincadeira sem persistir; cooldown entre abas; X1 completo, conflito, F5, saída e início
  da partida; conexão ociosa por 16 s; fim da sessão.
- Navegador com API real nas três telas (`minijogos-ao-vivo.spec.ts`): emoji, X1, conflito
  com entrega atrasada, dados sem polling, aba oculta e navegador fechado. A aba oculta é
  simulada sobrescrevendo `visibilityState`, porque o Chromium sem interface não oculta abas.
- Proxy: `docker_smoke.py --mode prod` em cópia sem as etapas de navegador confirmou 101 com
  o estado inicial e 403 para outra origem pelo Nginx. O smoke completo não chegou a essa
  etapa porque `acesso.spec.ts` falha igualmente na `master`.
- Vite: 101 em `http://127.0.0.1:8080` no ambiente local de desenvolvimento.

Falhas que existem igualmente na `master` limpa: 19 cenários das suítes de sala e preparação,
3 de `acesso.spec.ts` e `TestTransferredSelectionPreservesZoneRulesAndRollsBack`. A suíte
completa de navegador não foi executada. O limite de 75 s do Nginx com a conexão ociosa não
foi medido. A sensação visual depende de avaliação do usuário.

## Verificação das telas do designer em 31/10/2026

Cada estado foi capturado no Chromium sem interface, com jogadores reais na porta 8080, em
1440×895, e comparado lado a lado com as imagens, que têm cerca de 770 px por tela. Capturas de
1280×720, 860×600 e celular nas duas orientações também foram inspecionadas. A avaliação de
paridade é visual, feita por comparação, sem diferença automática de imagem.

`minijogos-ao-vivo.spec.ts` cobre convite, escolha em tempo real, conflito, lado travado,
desconfirmar, resultado, marca, registro, recusa, arregar, bandeja lateral, espera crescente e
tamanho do dado nas três telas com API real. A regressão focada de dez specs teve as mesmas 19
falhas da `master` limpa e nenhuma nova; `lobby-redesign.spec.ts` tem os mesmos 6 cenários falhando
na `master`. A integração `TestLive` e os testes internos passaram, e a suíte Go completa só falha em
`TestTransferredSelectionPreservesZoneRulesAndRollsBack`, igual à `master`. O smoke Docker não foi
repetido depois das telas; o Nginx não mudou. A suíte completa de navegador não foi executada.
