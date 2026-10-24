# Nova experiência da mesa

## Autorização

Em 24/10/2026, o usuário aprovou o redesign visual e de gestos a partir da
proposta e do mock em `docs/redesign/`. A aprovação foi dada pergunta a
pergunta. A spec vigente é a
[nova experiência](../specs/05-nova-experiencia-da-mesa.md).
Issue: https://github.com/rafacvs/mtg4fun/issues/39

Em 24/10/2026, o usuário pediu a construção pelo fluxo `/implement-spec`, numa
branch de integração, em vez de um PR por card.

## O que passa a valer

- Mesa de quatro no computador: faixa de oponentes, campo próprio e mão. Um a
  três jogadores usam a mesma composição. Cinco e seis rolam a faixa.
- Celular horizontal é o modo de jogo. Vertical é mão e leitura, com convite
  para girar. Isso reabre a [experiência mobile](34-experiencia-mobile.md) no
  ponto em que o vertical era plenamente jogável.
- Gestos: clique seleciona na hora, inspeção no mouse ou no toque longo, virar
  por tecla ou botão, duplo clique ainda vira. Barra de um nível e destinos
  nomeados no arraste. Densidade compacta ou confortável no lugar do zoom em
  porcentagem.
- A carta no campo continua a imagem inteira do catálogo.
- A consulta é uma vista do grimório. A contagem não cai enquanto a carta só
  está sendo olhada. Os outros veem a contagem e que há consulta, sem os nomes.
- O poder e a resistência impressos vêm do catálogo, separados do modificador
  manual e dos cinco marcadores de cor. A ficha não grava o impresso no
  modificador.
- Lobby, sala, decks e login ganham o visual. Dado que o servidor não tem
  aparece como exemplo e não é salvo.
- Playmat é véu na cor do assento até as artes. Depois, um playmat por cor de
  assento.

## O que fica para as issues já abertas

Compra inicial, comandante do deck, dados reais da biblioteca (exceto
exportar/colar/última jogada), prontidão reversível, reinício e criação
persistida passaram para a
[spec 06](../specs/06-preparacao-inicio-e-reinicio.md). Desfazer (37),
mulligan, recorte de arte, dano de comandante por oponente e sessão única
ficam de fora.

## Implementação

Ainda não começou.
