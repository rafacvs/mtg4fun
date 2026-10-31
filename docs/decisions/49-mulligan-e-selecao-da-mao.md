# Mulligan e seleção múltipla da mão

## Aprovação explícita

Em 29/10/2026, o usuário pediu seleção de várias cartas da mão por retângulo
com o mouse e dois tipos de mulligan configuráveis na preparação. Depois da
análise, aprovou que somente o criador escolha o tipo e que o padrão seja a
opção inicial.

## Comportamento aprovado

- **Padrão:** cada mulligan devolve a mão ao grimório, embaralha e compra sete.
  O primeiro é gratuito. Ao manter depois de mulligans adicionais, uma
  superfície central mostra a nova mão; o jogador seleciona somente as cartas
  que vão ao fundo, uma por mulligan além do primeiro.
  O sétimo mulligan deixa uma carta na mão; esse é o limite do modo padrão.
- **Aconchegaz:** todos os mulligans devolvem a mão, embaralham e compram sete,
  sem redução ao manter.
- A posição dos botões e o fechamento da janela foram substituídos pela
  confirmação de mãos descrita abaixo.
- A configuração, a janela, o número de mulligans e a decisão de manter são
  persistidos no snapshot. As ações usam o endpoint idempotente existente e
  não revelam o conteúdo da mão no registro público.
- Na mão, arrastar a partir do espaço vazio desenha um retângulo e seleciona
  todas as cartas atingidas, reutilizando a seleção e as ações coletivas locais.
- No painel do mulligan, manter o mouse sobre uma carta mostra sua prévia
  ampliada. No celular, toque curto abre a leitura da carta e pressão longa
  seleciona ou remove a carta destinada ao fundo; mover o dedo cancela a
  pressão para preservar a rolagem. Nomes longos usam reticências sem perder o
  nome completo para acessibilidade.

Não há migration: salas e partidas já persistem esses dados em snapshots JSON,
e snapshots anteriores adotam o modo padrão.

## Confirmação da mão antes de começar

Em 31/10/2026, o usuário relatou que um jogador comprava e passava o turno
enquanto outro fazia mulligan, o que cancelava o mulligan dele. Pediu que o jogo
só comece quando todos confirmarem a mão, e aprovou:

- Enquanto houver mão sem confirmar, a barra mostra só **Mulligan**, à esquerda,
  e **Confirmar mão**, que vira **Desconfirmar mão** ao ser clicado. Os demais
  botões, os atalhos e as ações da inspeção somem, inclusive Finalizar.
- O mulligan funciona como antes. Desconfirmar não faz nenhuma ação automática:
  as cartas enviadas ao fundo continuam lá, e o jogador refaz a mão manualmente
  pelo grimório se quiser.
- Uma pessoa ausente não é tratada: o usuário explicou que a mesa não depende de
  conexão e fica existindo, e que os amigos combinam quando jogar.

Escolhas de implementação, não pedidas literalmente:

- O servidor aplica a regra e responde 409. Quem não confirmou só pode trabalhar
  a própria mão com o grimório (comprar, consultar, embaralhar, revelar da
  consulta, mover entre mão e grimório e reordenar a mão); quem confirmou só pode
  desconfirmar.
- A confirmação é recusada durante uma consulta do grimório.
- Confirmar de novo pede somente as cartas ainda não enviadas ao fundo desde o
  último mulligan (`mulliganBottomed` no snapshot), limitadas às da mão.
- A última confirmação inicia a partida para todos, e então não há como desfazer.
- A fase é pulada quando a compra da mão inicial está desligada, e a tela lista
  quem falta confirmar. Essas duas constaram da lista confirmada pelo usuário.
- Partidas salvas com a janela aberta passam pela confirmação. Se todas as mãos
  já estiverem confirmadas, a janela é fechada na próxima ação.
