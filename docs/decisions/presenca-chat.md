# Presença e atalhos do chat

## Aprovação explícita

Em 11/11/2026 o usuário pediu Tab para abrir e fechar a crônica no chat, horário
nas mensagens, e escudos com estado dos jogadores junto ao tempo. Definiu verde
para a guia da partida, amarelo para outra guia e vermelho para desconexão.
Aprovou usar o WebSocket existente, em memória, sem histórico ou serviço novo,
e que uma guia visível prevaleça quando a pessoa tem várias abas abertas.
Depois pediu escudos pequenos ao lado do tempo de partida, remoção do tempo de
sala e números mais evidentes, em ordem crescente de turno.

## Implementação

O servidor combina a visibilidade das conexões autenticadas em cada sala e envia
o estado a quem está conectado. Sem conexão própria, a interface indica estado
indisponível em cinza; sem conexão de um jogador, vermelho. Navegadores reportam
mudanças de visibilidade e repetem o estado ao reconectar. Uma desconexão pode
levar até o mecanismo de detecção do WebSocket identificá-la. Os horários são
apresentados no fuso local do navegador a partir do timestamp salvo no chat.
Tab alterna a crônica e abre o chat, preservando Shift+Tab, diálogos e outros
campos de edição. A especificação anterior dos dois relógios é substituída só
na apresentação; os dados de criação da sala permanecem disponíveis.

Critérios: [presença e atalhos](../issues/presenca-chat.md).
