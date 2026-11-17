# Marcadores e modificadores na inspeção

Em 17/11/2026, o usuário aprovou marcadores independentes de +1/+1, -1/-1 e
veneno na inspeção. Os dois primeiros alteram o poder e a resistência exibidos;
veneno não altera esses valores. Os modificadores manuais existentes permanecem
independentes. O estado novo usa campo separado dos formatos antigos e segue as
mesmas permissões e limpeza de estado nas mudanças de zona.

O build, os testes Go do módulo de salas e o teste de navegador desktop em
janela visível passaram. O teste verifica edição, cálculo com modificador,
recarga, rejeição de valor negativo e limpeza ao mover. A avaliação do usuário
está pendente.

No teste do usuário, diminuir um marcador em zero produziu a mensagem genérica
de intervalo excedido. O botão de diminuir agora fica desativado em zero e a
API responde com mensagem específica para quantidade negativa. O build, os
testes Go de salas e o teste desktop em janela visível passaram após o ajuste;
a nova avaliação do usuário está pendente.
