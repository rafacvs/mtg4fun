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

Em andamento na branch de integração da spec 39. Os resultados finais serão
registrados antes da integração do card.
