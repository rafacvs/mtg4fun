# Queda de braço: acertos do convidado viram zero

Relato de 03/11/2026: ambos no computador, o amigo clicava nas faixas de soco,
mas todas as tentativas viravam “×” e zero pontos. Não era mensagem de erro
ou recusa de permissão. O usuário pediu corrigir somente o minigame, após
concluir o leaderboard, e investigar outras causas antes de mudar sincronização.

## Investigação

Com implementação original, testes de navegador com dois jogadores reais:

- Convidado pontuou nas condições normais e após recarregar.
- Dono e convidado pontuaram nas quatro cores, com convite invertido,
  pelos controles de relógio, botão e espaço.
- Diferença de relógio de um segundo e atraso controlado reproduziram a
  faixa vermelha visual virar zero. Somente atraso de rede também reproduziu.
- Testes Go de minigames e transporte com detector de concorrência passaram.

Isso comprova defeitos de dessincronização, mas não comprova a configuração
exata do computador do amigo. Não foi observada falha ligada ao papel do
jogador nos cenários normais exercitados.

## Aceite da correção

- Preservar cores, pontuação, cinco tentativas e Fase Maluco.
- Servidor continua decidindo os acertos.
- Testar pontuação real para ambos, não somente consumo de tentativas.
- Preservar os demais minigames, sala, partidas e dados.
- Registrar a escolha e seu estado de aprovação antes de implementá-la.

Escolha aprovada e implementação: [decisão da correção](../decisions/queda-de-braco-acertos.md).
