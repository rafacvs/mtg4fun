# Marcadores da seleção

Em 29/10/2026, o usuário pediu que o menu da seleção ofereça +1/+1,
-1/-1, edição de poder/resistência no formato X/Y e marcadores de cor.
Após ser informado de que a API anterior alterava uma carta e um atributo
por vez e de que a issue 18 exige atomicidade, aprovou explicitamente a
alternativa de uma operação coletiva atômica.

A ação `counter_batch` recebe IDs de cartas, operação e valor; o assunto
`pair` recebe também `secondValue`, e `marker` recebe uma cor. A transação
existente valida as permissões e os limites de todas as alterações e grava o
snapshot e a intenção juntos. Uma falha descarta a operação inteira; repetir
uma intenção confirmada não reaplica a alteração. O registro continua genérico
para proteger os dados de cartas privadas. Os contratos individuais permanecem.
Os botões de cor incrementam ou decrementam cada carta a partir do próprio
valor; o campo X/Y define o mesmo par para todas.

Após o teste visual, o usuário pediu consistência com os painéis existentes:
o menu de cores reutiliza o painel e os controles de marcadores. Valores
diferentes aparecem em branco. O campo X/Y mostra o par somente quando todas
as cartas compartilham os dois modificadores. Cartas sem poder e resistência
impressos também exibem o selo quando seu modificador não é zero.

O usuário forneceu uma nova referência visual para a barra inferior e os
painéis de marcadores da seleção e do jogador. A apresentação usa o mesmo
componente de linhas para ambos. A referência mostra uma cor branca; o modelo
existente conserva a cor amarela aprovada, sem alterar dados ou contratos.
