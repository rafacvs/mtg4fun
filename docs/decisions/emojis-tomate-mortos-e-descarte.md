# Emojis livres, tomate, jogadores mortos e descarte do grimório

Relaciona-se aos [minijogos por WebSocket](52-websocket-minijogos.md), ao
[modo espectador](54-modo-espectador.md), ao [jogador sem vida](53-ajustes-de-fichas-zonas-e-pilhas.md)
e ao [menu do grimório](grimorio-menu-fixo.md).

## Pedido do usuário em 02/11/2026

Na conversa, o usuário pediu:

- Espera progressiva dos emojis menos restritiva: “pode deixar spamar um pouquinho mais”, com a
  espera “demorar mais para aumentar e ser menor também”.
- Todos os emojis, “igual no WhatsApp”: os atuais fixados na bandeja e os demais numa grade maior
  com pesquisa. Isso substitui a “lista fixa no servidor” da decisão 52.
- Easter egg do tomate, que continua fixado: botão direito no 🍅 transforma o cursor num alvo, e
  clicar numa carta (própria ou de outro) mostra para todos a carta suja de tomate, com o caldo
  escorrendo, e logo limpa. Depois de testar, pediu que o alvo continue ligado para tacar em várias
  cartas até outro clique com o botão direito; que cada tomate caia num ponto diferente da carta;
  e que a explosão venha na metade do tempo depois de o tomate chegar.
- Passar o turno pula quem está com vida zero ou menos.
- Um botão para ocultar os campos de quem morreu, refazendo a grade para a quantidade de jogadores
  restantes, e para mostrá-los de novo.
- Descartar no menu do grimório: cartas do topo direto para o cemitério.

## Implementação

- **Espera:** começa em 120 ms, cresce 12% por envio até 1,2 s e zera após 3 s sem enviar (antes:
  200 ms, 35%, 3 s e 5 s). O tomate gasta a mesma espera. O aviso “Calma…” agora vale para a espera
  inteira quando ela passa de cerca de 0,7 s; antes só aparecia no começo dela.
- **Emojis:** o servidor aceita qualquer sequência de emoji (tons de pele, bandeiras, teclas e
  sequências unidas) e recusa texto, por propriedades Unicode, sem lista própria. A grade usa
  `emojibase-data` 17.0.0, com nomes e palavras-chave em português. A pesquisa ignora acentos. Os
  dados (~90 kB comprimidos) só baixam quando alguém abre a grade.
- **Tomate:** mensagem `throw` no jogo `emoji`, com o id da carta. O servidor só confere o formato do
  id e repassa `splat` para a sala; cada navegador mostra o respingo se a carta estiver no campo à
  vista. Nada é salvo. Enquanto o alvo está ligado, cliques fora das cartas são ignorados, e só o
  botão direito ou Esc desligam.
- **Turno:** avançar e corrigir pulam jogadores sem vida. Se só um estiver vivo, o turno volta para
  ele; se ninguém estiver vivo, anda uma posição.
- **Mortos:** o botão com a caveira aparece na barra (no celular, em Comandos, e na barra de quem
  assiste) quando algum oponente está sem vida. É preferência de quem olha, não é salva, e o campo
  principal sempre fica. Quem morre com os mortos ocultos sai da grade, e quem volta a ter vida volta.
- **Descartar:** ação `mill` com quantidade, ao lado de Comprar e Embaralhar. A primeira carta do topo
  cai primeiro, então a última descartada fica por cima do cemitério. O registro mostra as cartas
  para todos.

Escolhas de implementação, não pedidas literalmente: os valores exatos da espera; a lupa no fim da
bandeja para abrir a grade; as categorias com nomes próprios; o nome de quem tacou sobre o respingo;
o tranco da carta; a faixa de aviso do alvo; o pulo também ao corrigir o turno; a contagem de campos
ocultos no botão; a quantidade e a tela no mesmo quadro do menu para o descarte. A dependência
`emojibase-data` é só de dados e não altera a arquitetura.

## Verificação em 02/11/2026

Estes resultados comprovam comportamento observado, não aprovam escolhas.

- Go: teste unitário da validação de emojis, e a validação passou contra os 3.979 emojis e tons de
  pele do pacote. Integração com executável e MySQL reais: `TestLiveEmojiFallsForEveryoneWithServerCooldown`,
  `TestLiveTomatoSplatsACardForEveryone`, `TestPassingTheTurnSkipsPlayersWithoutLife` e
  `TestMillingPutsTheTopCardsInTheGraveyardForEveryone`.
  A suíte Go completa só falhou em `TestTransferredSelectionPreservesZoneRulesAndRollsBack`, falha já
  registrada na `master` em decisões anteriores e fora do que esta entrega altera.
- Navegador com API real nas três telas: `emojis-na-mesa.spec.ts` (grade, pesquisa, tomate contínuo),
  `nome-da-mesa-e-jogador-sem-vida.spec.ts` (turno e grade sem mortos), o descarte em
  `grimorio.spec.ts` e o spam em `minijogos-ao-vivo.spec.ts`. As capturas foram inspecionadas.
- Regressão de `grimorio`, `library-sheet`, `minijogos-ao-vivo`, `espectador`, `match-log`,
  `desktop-table`, `mobile-table` e `menu-acoes`: as 7 falhas restantes acontecem igualmente numa cópia
  limpa da `master`. A suíte completa de navegador e o smoke Docker não foram executados.
