# Refinamento visual e atualização conjunta de P/R

**Estado:** aprovado explicitamente; implementação dos novos refinamentos
pendente. Requisitos na [spec complementar](../specs/04-refinamento-ui-mesa.md),
entregas nos [cards locais](../issues/refactor-game-ui/README.md).

Após revisar a mesa da branch `refactor/game-ui`, o usuário pediu vida ao lado
do nome, edição de vida e P/R sem submenus e acabamento premium mobile-first.
Aprovou manter marcadores em acesso separado, confirmar inputs por Enter ou
perda de foco, usar elementos suaves condizentes com Magic e avaliar celulares,
dispositivos médios e desktop. A paleta original deve continuar preservada,
conforme pedido anterior e a [decisão 25](25-paleta-e-login-visual.md).

O usuário corrigiu o formato do controle para **`[−] [0]/[0] [+]`**. Foi
explicitado que os inputs são independentes e os botões alteram ambos em um.
À pergunta **“Confirma também as atualizações sequenciais pela API atual, com
aviso em caso de falha parcial?”**, respondeu **“ok”**.

A API existente atualiza um atributo por operação. Foi aprovada a sequência
de duas operações, com bloqueio de novos cliques durante o envio, conferência
de sucesso e aviso de falha parcial, sem repetir automaticamente incremento
já confirmado. O par não é atômico e poderá ficar parcialmente atualizado;
a recuperação de uma confirmação incerta deve preservar a intenção existente.
A alternativa de ampliar o backend para uma operação conjunta ficou fora do
escopo, em favor de preservar contratos e limitar a entrega ao frontend.

Demais comportamentos, semântica manual dos valores, permissões, privacidade,
coordenadas e fluxos da mesa permanecem. Esta decisão complementa a
[decisão 28](28-ui-mesa-responsiva.md) quanto à apresentação; não autoriza
novas funcionalidades, dependências ou alterações de infraestrutura.

Antes da implementação, o usuário redirecionou o trabalho para documentação
local e depois aprovou a divisão em quatro cards e a fronteira de testes:
navegador com API real/MySQL descartável, falhas específicas controladas,
persistência, permissões, teclado/toque e prints em múltiplas medidas. Isso
aprova o plano, não comprova sua implementação. A issue 21 e suas validações
históricas não são alteradas. Manter os documentos na branch atual, sem push.
