# Chat flutuante no estilo LoL

## Aprovação explícita

Em 17/11/2026, na autorização desta tarefa, o usuário pediu para ler o card
Notion `41bbb66538b6806eb80bcbc614cce0aa` e executar sem dúvidas pendentes. O
card pede separar chat e crônica e aprova um painel semelhante ao chat do LoL,
no canto inferior esquerdo ou local próximo. Um toque no atalho Z abre a
composição; manter Z pressionado mostra o histórico sem campo de texto. O
painel deve exibir o histórico recente com rolagem, usar fundo desfocado,
fontes legíveis e a cor do jogador no nome e na mensagem.

## Implementação

- A crônica continua dedicada ao registro e às estatísticas. O chat persistido
  abre como overlay independente para jogador e espectador.
- O atalho Z abre a composição; manter pressionado mostra somente o histórico,
  e soltar fecha essa visualização temporária. O botão acessível abre a
  composição em telas sem teclado.
- Esc fecha a composição. Enter envia texto não vazio e fecha a composição
  vazia; Shift+Enter mantém a quebra de linha. Rascunho permanece ao fechar e
  reabrir o painel.
- O histórico carrega ao abrir o chat; as atualizações periódicas só continuam
  enquanto o painel está aberto. Elas preservam a posição de leitura e evitam
  requisições concorrentes.
- O chat usa a API e persistência já existentes, mantém nomes coloridos por
  assento, horário, envio de atenção e participação dos espectadores.

Critérios funcionais: card Notion `41bbb66538b6806eb80bcbc614cce0aa`.
