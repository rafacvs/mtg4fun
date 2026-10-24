# Folha do grimório

Issue: [46](https://github.com/rafacvs/mtg4fun/issues/46), parte da
[spec aprovada](../specs/05-nova-experiencia-da-mesa.md). A autorização está na
[decisão 35](35-nova-experiencia-da-mesa.md); este registro descreve a
implementação, sem nova decisão de produto.

## Implementação

A busca abre uma grade com filtro por nome e tipo. O topo e o fundo usam a
mesma folha com uma faixa horizontal, ordenável pela alça com mouse, toque ou
teclas de direção. Cada carta mostra sua posição real no grimório.
A bandeja da seleção oferece os destinos diretamente, incluindo comando,
preservando os destinos já disponíveis. Minimizar apenas recolhe a folha:
a consulta, o filtro e a seleção permanecem. As duas saídas explícitas
fecham a consulta e a folha após a confirmação do servidor.

O catálogo lê `prop.type`. Somente as cartas da consulta do próprio jogador
recebem `type` e `libraryPosition` na resposta HTTP. Isso serve ao filtro e à
posição; não acrescenta tipo ao snapshot nem modifica as regras do campo.
As revelações públicas continuam sem a posição do grimório. As garantias de
contagem, privacidade e persistência seguem a
[consulta como vista](41-consulta-como-vista.md).

## Verificação

Os testes de navegador usam API e MySQL reais para observar filtro por tipo,
grade, bandeja, seleção após minimizar, contagem e bloqueio de compra,
reordenação do trecho, posição do fundo e as duas saídas. Os fluxos anteriores
do grimório foram adaptados para a faixa horizontal e os novos rótulos,
preservando as verificações de exposição, reordem por gesto e recuperação.
Os resultados executados acompanham o PR de integração.

Em 24/10/2026, os 21 cenários de `grimorio.spec.ts` e
`library-sheet.spec.ts` passaram nas três orientações, considerando as
repetições focais após corrigir quatro falhas da rodada ampla (17/21
inicialmente). A faixa horizontal excedia o painel com muitas cartas; o teste
observou a largura fora dos limites e passou após a correção. Os outros
ajustes foram sincronizar o fechamento, abrir os comandos recolhidos para
observar o bloqueio e rolar a folha até o rodapé na tela baixa.

O teste HTTP `TestLibrarySelectionVisibilityReturnAndRecovery`, incluindo
tipo/posição privada e ausência de ordem na revelação pública, passou.
`go vet ./...`, testes de `internal/catalog` e `internal/rooms`, typecheck,
build e `git diff --check` passaram. A integração do registro por turno foi
incorporada; a repetição horizontal final passou 3/3 após esse merge.
