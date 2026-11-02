# Queda de braço na sala de espera

Pedido explícito em conversa em 02/11/2026: adicionar uma opção abaixo de Cara ou
coroa no menu do jogador, com o PNG de medalhão fornecido; abrir o pop-up
“X1 · Queda de braço”, usando o HTML fornecido como referência. Preservar a sala
e suas funcionalidades. Desenvolvimento em branch própria, acessível na porta 8080.

- Dois jogadores reais; tela do jogo visível apenas para a dupla.
- Rodada normal: cinco tentativas por jogador, branco 12, amarelo 2, laranja 3,
  vermelho 6. Clique errado e volta completa sem clicar consomem uma tentativa com zero pontos. O ponteiro para ao completar cinco tentativas. Maior soma vence após ambos terminarem.
- Empate: Fase Maluco, velocidade +15%, somente branco, primeiro a três vence.
- Clique, toque e espaço; desistir conta como derrota; resultado para a sala.
- Preservar Cara ou coroa, dados, emojis e as demais funções existentes.

As regras vêm do HTML `queda_de_braco_5_acertos_fase_maluco.html` fornecido pelo
usuário. [Registro da implementação](../decisions/queda-de-braco.md).
