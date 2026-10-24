# Mesa no celular

Issue: [48](https://github.com/rafacvs/mtg4fun/issues/48), parte da
[spec 39](../specs/05-nova-experiencia-da-mesa.md).

## Autorização

A composição horizontal de jogo, a vertical de mão e leitura e os comandos
rotulados foram aprovados na [decisão 35](35-nova-experiencia-da-mesa.md).
Esta entrega substitui a apresentação móvel anterior da
[decisão 34](34-experiencia-mobile.md), sem mudar regras, sessão ou servidor.

## Implementação

`TableFields` é a composição compartilhada antes chamada `DesktopTable`.
Na horizontal, os oponentes ficam numa faixa vertical à esquerda, o campo
próprio no centro e o assento, as zonas e os comandos Comprar/Passar a vez
à direita. A mão permanece na borda com cartas sobrepostas em leque e
navegação horizontal. O campo mantém posições e os dados públicos autorizados.

Na vertical, a mão aparece em grade com imagens inteiras e um convite para
girar o aparelho. Tocar seleciona e abre a leitura ampliada com destinos
diretos em botões grandes. O modo Selecionar conserva a seleção múltipla sem
abrir a inspeção em cada toque; segurar continua inspecionando. A barra fixa
usa os rótulos Mão, Comprar, Desvirar, Passar a vez e Mais. Mais dá acesso a
informações, grimório, vida/marcadores e aos demais comandos já existentes.

Trocar orientação muda a apresentação e o eixo de navegação da mão, sem
recriar a partida nem sua conexão. A ordem local de organização, a seleção
e as cartas recebidas continuam na mesma árvore React. Ao arrastar sobre um
destino explícito, esse destino prevalece sobre a reorganização local da mão.
A barra contextual horizontal fica acima da mão para não bloquear os próximos
toques. A indicação da vez usa a cor do assento; movimento reduzido usa fade.

## Validação

TDD na fronteira aprovada de navegador com API e MySQL reais. Somente a arte
das cartas é controlada nos testes de gestos para não depender de rede externa.
Os REDs mostraram a faixa de oponentes ausente e o convite vertical ausente.
O fluxo de toque encontrou a barra cobrindo a segunda carta, o destino Campo
interpretado como organização e a grade vertical comprimida sem rolagem.
Esses comportamentos foram corrigidos e repetidos no navegador real.

A rodada final combinada passou nos oito cenários aplicáveis: seis de celular
(nas duas orientações, incluindo a regressão com 15 cartas) e dois de desktop
(um a seis jogadores e composição com quatro). As dez combinações omitidas
são cenários deliberadamente específicos de outra orientação ou de desktop.
Build, TypeScript e `git diff --check` passaram. Capturas foram inspecionadas.
Nenhum backend foi alterado e não foi repetida a suíte Go neste card.
