# Busca do grimório em duas etapas

## Aprovação

Em 30/10/2026, o usuário pediu na conversa, com referências visuais:

- enviar as cartas escolhidas para mão, campo, cemitério, exílio ou grimório,
  com topo e fundo apenas nas três últimas zonas;
- fechar a busca somente por "Fechar sem embaralhar" ou "Embaralhar e fechar",
  sem X e sem clique fora;
- aviso de saída vermelho, grande e em negrito, no lugar do tom da referência;
- reordenar cemitério e exílio arrastando a própria carta, sem alça, já que o
  backend precisaria mudar de qualquer forma.

## Implementação

A API aceita `libraryPlacement` também em `move` para `graveyard` e `exile`, e
ganhou a ação `reorder_zone`, que exige todas as cartas da zona. Não há mudança
de esquema. O topo dessas zonas é a última carta guardada.

Na busca, topo e fundo do grimório são aplicados reordenando a consulta. Um
`move` para o grimório faria as cartas restantes voltarem por cima da carta ao
fechar, levando ao fundo o que foi enviado ao topo.

## Interpretações sem aprovação explícita

- **Destinos:** Comando e Revelar saíram da busca, porque nem o pedido nem a
  referência os incluem. Continuam em Olhar e Revelar.
- **Destaque da etapa 2:** acende depois de um envio ou de uma tentativa de sair
  por Esc ou clique fora.
- **Leitura da carta:** o clique agora seleciona. A ampliação ocorre ao manter o
  mouse sobre a carta, e o botão direito abre a prévia.
- **Reabertura:** uma busca em andamento reabre o modal ao recarregar a página.

## Verificação

Teste de integração HTTP para posição e `reorder_zone`, testes unitários em Go e
fluxos `grimorio`, `library-sheet`, `zona-publica-arraste` e `acoes-http` em
navegador, com API e MySQL reais. Mobile não foi validado visualmente.
