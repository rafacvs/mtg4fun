# Quantidade de fichas, limpeza ao mudar de zona e divisão em pilhas

## Aprovação explícita

Em 31/10/2026, o usuário pediu os três ajustes abaixo no PR 109 e confirmou a
lista de tarefas antes da implementação.

## Comportamento

- **Fichas:** o botão "Criar ficha feita pela carta" da inspeção ganhou um campo
  de quantidade, que começa em 1.
- **Mudança de zona:** a carta perde os ajustes de poder/resistência, os
  marcadores de cor e o status de virada. Isso substitui a regra anterior, que
  limpava apenas do campo para o cemitério ou o exílio.
- **Pilhas:** soltar no campo mais cartas do que cabem na pilha de destino não é
  mais recusado. A pilha é completada até 3, e o restante abre novas pilhas.

## Escolhas de implementação, não pedidas literalmente

- A quantidade vai de 1 a 99. As fichas são criadas numa só ação, com uma linha
  no registro; a falha de uma desfaz todas.
- A limpeza vale para qualquer origem e destino diferentes, inclusive grimório.
  Um marcador colocado numa carta na mão é perdido quando ela entra no campo.
- A face para baixo só é limpa ao sair do campo. A lista confirmada dizia que a
  carta voltaria com a face para cima em qualquer mudança de zona, mas isso
  impediria jogar uma carta da mão virada para baixo.
- As novas pilhas usam as próximas células vazias da mesma fileira, sem misturar
  com cartas que já estão lá. Isso vale também para uma única carta solta sobre
  uma pilha cheia, vinda de outra zona. Reposicionar cartas dentro do campo
  continua recusando a pilha cheia.

## Nome da mesa e jogador sem vida

Também em 31/10/2026, o usuário pediu o nome da sala na preparação, em lugar que
ficasse melhor no layout, e o campo apagado com uma caveira ou um fantasma quando
o jogador estiver com 0 de vida ou menos. A marca olha só para a vida: voltar a
ter vida a remove.

Escolhas de implementação: o nome substitui o título "À mesa" nas etapas de
preparação e de dados, e nomes longos terminam em reticências. A marca é uma
caveira que flutua, por cima só do campo, e não bloqueia cartas nem zonas.

## Barra de espaço

Também em 31/10/2026, o usuário definiu que, no jogo, Espaço avança o turno e
Shift+Espaço corrige o turno, e que o espaço não faz mais nada: outros usos são
cancelados.

Foram retirados o espaço da seleção de cartas na consulta e na busca do grimório,
onde Enter continua, e o acionamento do botão em foco. Escolhas de implementação:
o espaço continua digitando em campos de texto; com um painel modal aberto ou
durante a confirmação de mãos, não faz nada; a tecla N continua passando o turno;
a tela de entrada, fora do jogo, não mudou.

