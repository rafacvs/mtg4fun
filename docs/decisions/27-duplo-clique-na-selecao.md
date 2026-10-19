# Duplo clique para virar/desvirar a seleção

## Solicitação e escopo

Em 19/10/2026, o usuário relatou que selecionar quatro cartas e dar dois
cliques não virava o conjunto, e pediu a correção. Isso autoriza ligar o
gesto à seleção, como entrega parcial da [issue 18](../issues/18-acoes-em-multiplas-cartas.md),
preservando as demais pendências dessa issue.

A correção está local na branch `fix/virar-selecao-duplo-clique`, baseada
na implementação de seleção/controle existente e com os ajustes locais do
menu preservados. Não foi integrada à master.

## Comportamento

Duplo clique com mouse em uma carta selecionada aplica a todas as selecionadas
o estado oposto da carta clicada. A seleção permanece, permitindo desvirar o
conjunto com outro duplo clique. Estados iniciais diferentes convergem ao mesmo
estado alvo. Duplo clique fora da seleção afeta somente a carta clicada.

O clique simples com mouse aguarda o intervalo de 350 ms já usado pelo detalhe,
para distinguir o duplo clique sem remover/reinserir cartas na seleção. Toque e
ativação por teclado mantêm a seleção imediata. O gesto envia uma única ação
`set_tapped` com `cardIds`, usando contrato, permissões, transação, log e retry
já existentes. Sem mudança de backend, banco, dependências ou design.

## Verificação e confirmação manual

A falha foi reproduzida no navegador antes da correção. Depois passaram o
build/TypeScript e os dois testes de `virar-selecao.spec.ts`, no desktop:
seleção pelo menu e por área, quatro cartas, virar/desvirar, estados mistos,
um único comando/log com contagem quatro, cartas fora da seleção e de outro
jogador intactas, clique simples e recuperação após recarga. A API e o MySQL
são reais; somente as imagens são controladas.

O usuário confirmou nesta conversa: **“testei aqui e tá funcionando normal”**
e **“a correção funcionou”**. Essa confirmação é da correção do duplo clique;
não conclui os demais critérios da issue 18 nem autoriza merge na master.
Não foram executadas novas suítes Go ou de Docker nesta correção do frontend.

## Revisão para publicação

Em 19/10/2026, o usuário informou que seus testes estavam funcionando bem e
solicitou verificar a issue 09 e abrir um PR explicando a implementação e as
opções das ações. A publicação é preparada na branch
`review/issue-09-selecao-e-acoes`, baseada na correção existente. O pedido
autoriza publicar o PR para revisão; não autoriza merge.

O estado atual difere das etapas históricas acima e do registro 26:

- Seleção múltipla apenas por retângulo com mouse; os controles de ativar
  seleção e adicionar/remover cartas por clique/toque foram removidos.
- Clique no espaço vazio do campo ou Escape limpa a seleção. O clique
  gerado ao concluir o retângulo não desfaz a seleção recém-criada.
- Clique/toque na carta abre seu detalhe; duplo clique com mouse em uma
  selecionada vira/desvira o conjunto em uma única ação `set_tapped`.
- A barra rápida contém Comprar, Desvirar todas e Ações. Passar turno e
  Grimório ficam em Ações; Desvirar todas não se repete no painel.
- Transferência de controle e retorno ao dono acompanham o PR porque já
  integram a implementação sobre a qual esta correção foi construída.

A seleção por toque continua sendo um requisito das specs e da issue 09;
esta revisão registra sua ausência sem declarar o requisito dispensado.
Movimento entre zonas e contadores coletivos da issue 18 continuam pendentes.
O relato manual do usuário não substitui esses critérios nem conclui as
issues integralmente.

### Verificações desta revisão

Em 19/10/2026 passaram build/TypeScript, os três testes unitários do frontend,
`go -C api vet ./...` e `go -C api test ./... -count=1`, incluindo todas as
integrações HTTP com MySQL temporário. Estas exercitam atomicidade, falha real
de persistência, reenvio, permissões, privacidade e recuperação após reinício.

A regressão `npm test --prefix app -- --workers=3` teve 74 cenários aprovados,
33 omitidos pelos critérios de orientação/mouse/opt-in e uma falha do Chromium
ao capturar a tela no login sem WebGL em celular. A repetição isolada desse
cenário passou, sem alteração de código. Os fluxos de seleção/movimento,
limpeza no espaço vazio, duplo clique, controle e navegação do menu passaram
na execução completa. Os testes coletivos por mouse são omitidos nos perfis
de toque; isso não comprova seleção múltipla no celular.

Links locais e `git diff --check` foram conferidos. Não foram repetidos o smoke
Docker de produção nem a verificação opt-in do provedor de imagens; esses
componentes não foram alterados. O build mantém o aviso de chunk Three.js
maior que 500 kB já existente.

Depois da revisão, o usuário reiterou: **“aparentemente tá tudo ok aqui, pode
abrir o pr para a master”**. O PR permanece aberto, sem merge.
