# Queda de braço — 02/11/2026

## Autorização

O usuário pediu explicitamente a [feature](../issues/queda-de-braco.md), usando o
PNG e o HTML fornecidos, em branch nova e na porta 8080. Depois reforçou que a
sala e todas as funcionalidades existentes devem ser preservadas. Essa autorização
cobre a feature; não implica aprovação de nova arquitetura.

## Implementação no escopo existente

Reutiliza o canal e o ciclo do X1 da [decisão 52](52-websocket-minijogos.md):
convite, aceitar/recusar, cancelar, arregar, presença, expiração, marcas e histórico
em memória. Uma pessoa continua participando de um X1 por vez. Não há banco,
dependência, serviço ou transporte novo. O campo opcional `game` distingue a
queda de braço; mensagens antigas de Cara ou coroa permanecem válidas.

O servidor define zonas, tempo e pontuação; o navegador anima os relógios e envia
o gesto, sem declarar pontos ou ângulos. A avaliação usa o instante de chegada ao
servidor: latência pode afetar acertos nas zonas estreitas. A
[correção de 03/11/2026](queda-de-braco-acertos.md) sincroniza a animação e compensa
visualmente o envio, preservando essa avaliação. Ambos clicam Começar;
a contagem de um segundo permite iniciar juntos. F5 recupera o estado corrente.

O HTML simula um adversário; aqui o adversário é outro participante real. Após o
resultado, um novo jogo usa o menu existente, sem reiniciar unilateralmente o duelo.

A branch `feat/queda-de-braco-sala` parte de `feat/meus-playmats`, porque essa é a
implementação que estava ativa e o banco local já contém sua migration. Isso
preserva o estado existente solicitado, sem reverter ou apagar dados.

## Ajustes explícitos na mesma conversa

O usuário substituiu os cinco acertos por cinco tentativas: “o clique errado ja
consome a tentativa e caso nao clique consome a tentativa tb”. Cada volta sem
clique e cada clique errado consomem uma tentativa com zero pontos. Ao terminar,
o ponteiro congela. Pediu soquinhos vetoriais coloridos como o HTML e medalhão com
o mesmo tamanho de Cara ou coroa (46 px). O desempate continua sendo primeiro
a três brancos.

## Verificação

- Build e TypeScript passaram. Testes de minijogos em Go passaram com `-race`.
- Navegador com API e MySQL reais: três projetos passaram após a regra final
  (desktop, celular e celular horizontal), cobrindo convite, acerto, F5, consumo
  das cinco tentativas, volta sem clique, ponteiro congelado, resultado e desistência.
- Cara ou coroa, emojis e dados passaram nos três projetos na regressão focada
  anterior à última mudança de regra. A suíte completa não foi executada.
- Capturas de menu e pop-up foram inspecionadas. A margem transparente do PNG
  foi compensada em CSS para igualar o diâmetro visível ao medalhão de 46 px.
- API de desenvolvimento voltou a responder na porta 8080 com a base existente.
