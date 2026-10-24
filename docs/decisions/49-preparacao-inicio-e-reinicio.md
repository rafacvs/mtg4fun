# Preparação, início e reinício

Issue da spec: [52](https://github.com/rafacvs/mtg4fun/issues/52). Cards: [34](https://github.com/rafacvs/mtg4fun/issues/34),
[35](https://github.com/rafacvs/mtg4fun/issues/35),
[38](https://github.com/rafacvs/mtg4fun/issues/38),
[33](https://github.com/rafacvs/mtg4fun/issues/33),
[36](https://github.com/rafacvs/mtg4fun/issues/36).

## Autorização

Em 24/10/2026, o usuário refinou as issues abertas pergunta a pergunta e
confirmou o entendimento compartilhado. Em seguida pediu gravar as decisões
numa spec, com o GitHub como issue tracker.

Essa autorização cobre o contrato desta spec. Não autoriza desfazer a última
ação (issue 37), exportar/duplicar/colar/corrigir nomes, “quando foi jogado”,
tela de histórico nem a limpeza das redes Docker (issue 14). A política da
issue 14 foi combinada na mesma conversa e permanece nessa issue, fora deste
lote.

A escolha de persistência do jogo abandonado — arquivo morto, `matches`
continuando 1:1 com a sala, sem N partidas vivas — foi apresentada com a
alternativa (identidade própria de partida) e aprovada explicitamente.

## O que passa a valer

- Tipo, CMC, cores e identidade vêm do XML do catálogo e se resolvem na
  listagem. O comandante é escolha do dono na lista do deck, um por deck.
- Criar mesa grava nome, formato (rótulo), lugares, vida daquela sala e deck
  opcional do criador, sem prontidão automática. Depois de criar, não se
  edita. Deck selecionado e pronto são campos distintos.
- Todo início compra sete. O comandante escolhido, se ainda estiver no
  grimório, vai ao comando antes das sete.
- Reinício por unanimidade volta à preparação de verdade, não convive com
  finalizar, e arquiva snapshot e log da partida abandonada. Encerrar não
  muda.

O detalhe está na [spec](../specs/06-preparacao-inicio-e-reinicio.md).

## Implementação

Ainda não começou.
