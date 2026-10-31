# Seleção por botão direito e revelação da mão

## Aprovação explícita

Em 31/10/2026, o usuário pediu na conversa, na branch `work/dice-bounce`:

- O menu inferior da seleção aparece a partir de uma carta selecionada, por Shift
  ou botão direito com o mouse, e não mais só com duas ou mais.
- Clique com botão direito adiciona ou remove a carta da seleção. O esquerdo
  continua abrindo a inspeção. Isso substitui o botão direito abrindo a inspeção.
- Cartas da mão são selecionadas com botão direito ou Shift + botão esquerdo, e um
  menu igual ao da seleção no campo oferece campo ou revelar para jogadores.
- Revelar para jogadores aceita qualquer oponente, sem limite, e revela **apenas**
  para eles.
- Os menus seguem o padrão do jogo.
- Toda a área amarela do botão de turno avança; só a parte esquerda corrige.

## Implementação

Escolhas de implementação, não pedidas literalmente:

`reveal_cards` ganhou o campo aditivo `revealedTo`, com `revealed: true` e ao menos um
jogador. Sem ele, a ação continua igual. O servidor recusa o próprio jogador, quem não
está na partida, repetição e carta fora da mão. Só a dona e os escolhidos recebem a
carta em `exposedCards`; os demais não recebem identidade nem ID.

O registro mostra a todos quem revelou, quantas cartas e para quem. O nome da carta só
vai para a dona e os escolhidos, a partir da carta visível naquele momento.

A revelação escolhida vale até ocultar, inclusive por **Ocultar todas reveladas**, ou
até passar o turno, como as demais (decisão [22](22-ajustes-da-mesa.md)). Ela acaba ao
sair da mão e não volta se a carta retornar, diferente da revelação pública, que
continua ao mudar de zona (decisão [11](11-estados-e-revelacoes.md)): uma carta no
grimório não pode seguir exposta para poucos. Revelar para outros substitui a escolha
anterior, inclusive uma revelação pública.

O clique simples com o esquerdo continua deixando a carta como alvo dos atalhos, mas
não abre o menu. Selecionar carta de outra zona começa uma seleção nova, sem misturar
mão e campo. Botão direito em carta de outra pessoa não faz nada. No celular, o menu
da mão usa o modo **Selecionar cartas** já existente.

No desktop, a faixa de reveladas passou a ficar sobre o campo, com cartas maiores: nos
campos dos oponentes ela era limitada a 50 px e cortava a carta. Isso também vale para
as revelações públicas.

## Verificação

Em 31/10/2026, um teste de integração com três jogadores e MySQL real cobriu quem
recebe a carta, a resposta de quem não foi escolhido, o registro, recusas, reinício,
ocultar, turno e saída da mão. `selecao-e-revelacao-mao.spec.ts` passou com API e MySQL
isolados no desktop e no celular nas duas orientações. Capturas do painel, da barra, da
carta recebida e do botão de turno foram inspecionadas.

Falham igualmente na `master`, sem esta mudança, sete cenários no desktop
(`card-actions.spec.ts`, `estados.spec.ts`, `marcadores-selecao.spec.ts`) e nove no
celular (`game-ui.spec.ts`, `mobile-experience.spec.ts`, `mobile-table.spec.ts`). Por
isso, o ajuste do botão direito em `card-actions.spec.ts` e a faixa de reveladas em
`estados.spec.ts` não ficaram cobertos por esses cenários. A regressão completa não foi
executada.

## Mão inteira e marcadores na carta

Em 31/10/2026, o usuário pediu a mão em leque com as cartas inteiras embaixo, 10% menores,
e os marcadores de cor da carta na lateral esquerda, com ícone pequeno e número. Ele
testou na porta 8080, disse que estava funcionando e dispensou mais testes.

Escolhas de implementação, não pedidas literalmente: a redução e a carta inteira valem
para a mão no desktop, que agora sobe mais sobre o campo próprio; o celular não mudou.
Os marcadores mudaram em toda carta exibida como carta na mesa.

Uma proposta de mostrar poder e resistência totais na inspeção foi implementada e
desfeita a pedido do usuário; o campo continua mostrando o modificador.

Verificação: `mao-e-marcadores-na-carta.spec.ts` passou no desktop. Oito cenários de
`desktop-table.spec.ts` e `game-ui.spec.ts` e um de `contadores.spec.ts` falham igualmente
na `master`, portanto não cobrem esta mudança. Depois de centralizar os marcadores da
mão, a captura não foi inspecionada. A regressão completa não foi executada.

