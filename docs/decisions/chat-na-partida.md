# Chat na partida

## Aprovação explícita

Em 11/11/2026, o usuário pediu uma aba **Chat** após **Terrenos / Draws**,
sem o título visível **Crônica**. Confirmou que o histórico deve ser salvo e
que jogadores e espectadores podem ler e enviar mensagens. Pediu também uma
funcionalidade semelhante ao aviso de atenção do MSN, que treme a tela.

Após consulta, aprovou salvar mensagens no MySQL, usar endpoints HTTP
ficando a tremida no WebSocket existente, com limite de frequência. O usuário
pediu depois envio com Enter e nomes na mesma cor do escudo de vida.
Esta aprovação amplia o uso do canal efêmero da sala, anteriormente restrito
às brincadeiras, sem definir o transporte das ações da partida.
Em seguida, o usuário pediu **Chat** à esquerda de **Terrenos / Draws**.

## Implementação

- Durante a partida, usuários autenticados que jogam ou assistem consultam e
  enviam texto pelo chat. O histórico é persistido em MySQL, associado à partida;
  espectadores continuam sem acesso depois do encerramento. Mensagens aceitam
  até 1000 caracteres, e são exibidas como texto. A atualização é periódica.
- Enter envia; Shift+Enter insere uma quebra de linha. Nomes dos jogadores usam
  a cor do respectivo escudo, identificados pelo ID; espectadores usam cor neutra.
- A tremida é entregue às conexões presentes, sem histórico. Conforme o ajuste
  pedido pelo usuário, cada pessoa pode enviar sete avisos antes de uma pausa
  de três segundos, aplicada pelo servidor. A animação respeita a
  preferência do sistema por movimento reduzido e não é reproduzida em aba oculta.
- O botão aparece dentro do chat. O registro e os demais filtros permanecem.

Critérios: [chat na partida](../issues/chat-na-partida.md).
