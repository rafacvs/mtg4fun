# Mesa de quatro no computador

## Autorização

Implementa o card [43](https://github.com/rafacvs/mtg4fun/issues/43), parte da
[spec aprovada](../specs/05-nova-experiencia-da-mesa.md) e da
[decisão 35](35-nova-experiencia-da-mesa.md). Não abre decisões de produto:
a composição e a substituição de foco/zoom foram aprovadas na spec.

## Implementação

No computador, `DesktopTable` mantém uma faixa de oponentes, o campo próprio e
a mão simultâneos. Um a três participantes usam a mesma estrutura; cinco e
seis conservam uma única faixa com rolagem horizontal. A ordem de turno é
pública, e a cor do assento destaca quem está na vez e o véu do campo. As duas
faixas pintadas orientam permanentes e terrenos sem alterar posições ou
classificar cartas automaticamente.

`PlayerSeat` reutiliza o editor numérico existente para vida própria e exibe
os cinco marcadores de cor. Os valores dos oponentes continuam somente para
leitura. Os montes mantêm a imagem inteira do topo público, verso do grimório
e contagens vindas da API. A densidade define tamanhos de carta por contexto,
sem controle em porcentagem. A inspeção existente continua disponível.

O fluxo mobile anterior fica disponível até o card 48. Seleção imediata,
barra, menu, destinos de arraste e estado pendente pertencem ao card 45;
folha do grimório e apresentação do registro pertencem aos cards 46 e 47.
Esses cards reutilizam esta superfície sem alterar os contratos da API.

## Validação

A implementação começou com uma falha no navegador/API real: a região de
oponentes não existia. Outra falha mostrou uma carta do oponente na posição
400/fileira 4 fora da área visível; a projeção compacta passou a preservá-la
visível sem regravar o snapshot.

- `npm run build --prefix app` e typecheck passaram, inclusive após incorporar
  a ponta da integração com o card 44.
- Sete cenários focais desktop passaram: composição de quatro, matriz de um a
  seis, montes públicos, vida direta persistente, densidade, editores,
  permissões, falha parcial e selo de poder/resistência com a API real.
- Treze regressões desktop passaram, considerando as repetições focais após
  correções: prévia, privacidade, revelações, comandos, menus, orientação,
  dimensões de 320 a 1920 px, posições esparsas, seleção, homônimos, seis
  participantes, arraste/pilhas e transferência de controle.
- As regressões detectaram e corrigiram a subida dos montes quando surgiam
  cartas reveladas. O helper de comandos passou a aguardar a transição para
  desktop antes de acessar controles móveis. A verificação de empilhamento
  observa sobreposição e deslocamento no tamanho exibido, em vez de exigir
  oito pixels de deslocamento de uma carta mobile de 26 pixels.
- `git diff --check` passou. Não houve alteração de backend neste card, nem
  nova execução da suíte Go.

Os cenários mobile completos serão verificados pelo card 48. A matriz de
larguras acima usa o projeto desktop do Playwright; não equivale a testar os
três projetos de dispositivo.
