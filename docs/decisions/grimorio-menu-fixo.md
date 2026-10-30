# Menu do grimório em quadro fixo

## Aprovação

O usuário pediu na conversa de 30/10/2026 que o menu do grimório seguisse a
lógica do menu de ações: tamanho fixo, conteúdo editado dentro dele e paridade
visual com as referências enviadas. A busca é a única exceção e mantém seu modal.
Também pediu a remoção dos subtítulos de Comprar e Embaralhar, que constam nas
referências.

## Implementação

Menu, Comprar, Olhar e Revelar usam o mesmo quadro de 430 × 588 px, ancorado à
pilha do grimório e acima da mão quando há espaço. Olhar de topo ou fundo
abandona a seleção por botões e usa opções de rádio.

**Interpretação sem referência visual:** os resultados de Olhar e Revelar
permanecem no mesmo quadro, porque somente a busca foi citada como exceção. O
layout dessa tela ainda não tem aprovação visual do usuário.

## Verificação

Em 30/10/2026, as telas foram capturadas em Chromium headless contra o Docker
local em 1440 × 900 e 1100 × 700. As ações foram interceptadas no navegador, sem
escrita no banco, para conferir os comandos enviados. Os fluxos de navegador em
`app/tests/e2e/` foram adaptados aos novos rótulos, mas não foram executados.
