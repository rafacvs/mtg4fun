# Meus playmats

Origem: solicitação e duas imagens de referência fornecidas pelo usuário em
02/11/2026. Trabalho na branch `feat/meus-playmats`, na worktree principal,
mantendo a aplicação local na porta 8080.

## Entrega e critérios de aceite

- Aba **Meus playmats** ao lado de Salas e Meus decks.
- Biblioteca pessoal com upload por clique ou arraste de JPG, PNG ou WEBP,
  até 10 MB por imagem, e exclusão de imagens da biblioteca.
- Quatro cenários existentes, modo aleatório e prévia nas proporções 16:9,
  21:9, 16:10, 4:3 e celular.
- Ajustes Cobrir, Conter, Esticar e Repetir; zoom e escurecimento, com gravação
  explícita e confirmação somente após a persistência.
- Uploads e preferências no MySQL, por conta. Cada jogador vê o mesmo playmat
  de cada campo; espectadores também veem os fundos da partida.
- No início da partida, fixar a escolha e os ajustes de cada jogador, sorteando
  um dos quatro cenários quando aleatório. Recarregar e reiniciar o servidor
  preservam o fundo; mudanças posteriores só afetam novas partidas.
- Preservar partidas em andamento ao excluir imagens da biblioteca.
- Seguir o padrão visual de Salas e Meus decks: fundo geral, marca, cores,
  tipografia e largura máxima de 1280 px compartilhados.

A referência inicial exigia reprodução da composição apresentada. Em seguida,
o usuário pediu a padronização visual com Salas e Meus decks e aprovou o
resultado com **“ta certinho agora, pode abrir um pr”**.

Decisões, autorização e contrato: [Meus playmats](../decisions/meus-playmats.md).
