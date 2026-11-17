# Marcadores e modificadores na inspeção

Em 17/11/2026, o usuário aprovou marcadores independentes de +1/+1, -1/-1 e
veneno na inspeção. Os dois primeiros alteram o poder e a resistência exibidos;
veneno não altera esses valores. Os modificadores manuais existentes permanecem
independentes. O estado novo usa campo separado dos formatos antigos e segue as
mesmas permissões e limpeza de estado nas mudanças de zona.

Na revisão seguinte, o usuário pediu remover o marcador de veneno da inspeção.
A ação de veneno foi retirada; um eventual valor já salvo durante os testes é
preservado no snapshot até a limpeza normal da carta ao mudar de zona.

O build, os testes Go do módulo de salas e o teste de navegador desktop em
janela visível passaram. O teste verifica edição, cálculo com modificador,
recarga, rejeição de valor negativo e limpeza ao mover. A avaliação do usuário
está pendente.

No teste do usuário, diminuir um marcador em zero produziu a mensagem genérica
de intervalo excedido. O botão de diminuir agora fica desativado em zero e a
API responde com mensagem específica para quantidade negativa. O build, os
testes Go de salas e o teste desktop em janela visível passaram após o ajuste;
a nova avaliação do usuário está pendente.

O usuário pediu a inspeção conforme as imagens de referência, preservando os
controles existentes, com a carta sempre em pé e indicação de virada abaixo.
Depois pediu ícones maiores e a carta e o texto mais legíveis. Ao revisar a
apresentação, disse “ficou lindo de mais”. Os marcadores coloridos passaram
a ser editados diretamente; os marcadores +1/+1 e -1/-1 continuam independentes.

O build e os testes de navegador da inspeção e dos marcadores passaram no
desktop; o teste de marcadores também passou no celular. A transferência e a
edição de poder/resistência passaram em repetição no desktop. A suíte antiga
de ajustes no celular falhou na preparação, antes de abrir a inspeção, porque
as mãos não estavam confirmadas; ela não valida esta alteração.
