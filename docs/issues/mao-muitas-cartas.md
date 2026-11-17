# Mão com muitas cartas

O card de Fabricio Souza pede que cartas na mão continuem acessíveis quando
há mais de dez. Em 17/11/2026, o usuário pediu uma disposição que se ajuste à
posição do mouse, abrindo espaço próximo ao ponteiro nos lados da mão.

No desktop, a mão distribui o espaço disponível com maior separação perto do
ponteiro quando contém mais de dez cartas. Ao sair, retorna ao leque habitual;
o tamanho das cartas e as interações existentes são preservados.

Verificação: build do frontend e quatro testes de navegador desktop de
`mao-e-marcadores-na-carta.spec.ts`, incluindo mão com 16 cartas e movimento
do ponteiro para os dois lados, passaram.
