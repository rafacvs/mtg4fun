# Paridade visual obrigatória com o HTML V2

## Estado

Requisitos aprovados explicitamente na conversa de 25/10/2026 e publicados na
[issue 70](https://github.com/rafacvs/mtg4fun/issues/70), com `ready-for-agent`.
A implementação corretiva foi entregue tecnicamente na branch de integração
da issue #70. O aceite visual explícito do usuário continua pendente na
issue #81; ele não é substituído por testes automatizados nem pela revisão do
agente.
A fonte consolidada é a [spec de paridade](../specs/07-paridade-visual-v2.md);
este registro documenta a autorização, sem duplicar todos os requisitos.

## Contexto investigado

A [issue 57](https://github.com/rafacvs/mtg4fun/issues/57) foi entregue pelo
[PR 69](https://github.com/rafacvs/mtg4fun/pull/69), mas não exigia paridade
visual 1:1 com inventário e aceite por tela. A auditoria usou Chromium headless
via Playwright na aplicação local, sala 4, e renderizou as pranchas HTML.
As capturas documentam o estado anterior à correção, não aprovação do produto.

Os documentos V2 locais já tinham cópias idênticas versionadas na branch de
planejamento, com nomes diferentes, referenciadas pela issue 57. Esta entrega
incorpora os dois arquivos com nomes normalizados à documentação integrada;
a origem e os hashes estão na spec. Não atribuir a divergência visual apenas
a uma suposta ausência completa de referências versionadas.

## Evidência da aprovação explícita

| Rodada | Resposta e alcance |
| --- | --- |
| Q1 | “OK”: HTML principal, PDF complementar, nove pranchas de interface; login/lobby/decks/preparação sem alvo 1:1 nesses documentos. |
| Q2 | “ok”: preservar campo único manual, sem fileiras obrigatórias ou pilhas automáticas. |
| Q3 | “siga em tudo, mas em campo mantenha a imagem da carta inteira para facilitar”: acabamento V2 com carta inteira. |
| Q4 | “ok”: capturas comparáveis nos quatro viewports, layouts de 2–6, testes funcionais e revisão visual do usuário. |
| Q5 | “ok”: preservar ações existentes nos menus/painéis correspondentes da V2. |
| Q6 | “sim, mas vou pedir explicitamente apos terminarmos o refinamento”: aguardar pedido para formalizar spec/issues. |
| Q7 | “ok”: quatro playmats reutilizados, associação estável ao participante e repetição para cinco/seis com identidade distinta. |
| Q8 | “sim”: adaptação de encaixe e alturas sem ocultar campos ou sobrepor controles; campo próprio maior no vertical. |
| Q9 | “sim”: confirmação do resumo e encerramento do refinamento. |

Após Q9, o usuário pediu explicitamente transformar o refinamento em nova spec
via to-spec no GitHub, enfatizando a referência do HTML para garantir paridade
visual. Esse pedido autorizou a publicação dos requisitos, mas não constituiu
aprovação antecipada das telas entregues. A aprovação visual permanece uma
etapa humana posterior, registrada na issue #81.

## Relação com decisões anteriores

A paridade substitui a liberdade de calibração visual da issue 57 nos estados
com referência. Mantém suas exceções funcionais de campo manual e suas
invariantes de posição, privacidade, permissão e sincronização. Substitui a
espera por novas artes da [decisão 35](35-nova-experiencia-da-mesa.md): os
quatro fundos do HTML estão disponíveis e serão reutilizados.

A [spec da mesa V2 anterior](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/specs/06-mesa-v2-campo-unificado.md)
e seu [registro de decisões](https://github.com/rafacvs/mtg4fun/blob/201def94d0ec94a704360ddc91e5380a6f90eabb/docs/decisions/mesa-v2-campo-unificado.md)
permanecem referências históricas. Os pontos conflitantes da apresentação
anterior cedem ao HTML V2 e às exceções explícitas da nova spec. Arquitetura,
banco, API, infraestrutura e regras de jogo não foram reabertos.

## Implementação e validação

Esta tarefa publica requisitos e referências, não código da interface.
Nenhum resultado histórico de teste foi convertido em validação nova.
O aceite futuro requer os fluxos reais e comparativos definidos na spec,
seguidos de revisão visual explícita do usuário.

## Correção visual em andamento — 27/10/2026

Na revisão da implementação da issue 70, o usuário relatou divergências
significativas em relação ao HTML V2 e pediu a correção gradual, com capturas
comparativas e consulta prévia caso seja necessário alterar lógica, backend ou
banco. A aprovação da spec não representa aprovação visual da implementação.

O usuário autorizou explicitamente ajustar a lógica de distribuição visual
dos participantes conforme a ordem do turno, sem alterar dados ou regras da
partida. Também orientou que, quando o protótipo não apresenta um desenho
específico para estados como carta revelada ou controlada por outro jogador,
o trabalho de paridade se concentre no que está representado no protótipo.
Os indicadores e capacidades existentes desses estados continuam preservados;
essa orientação não é aprovação de um novo desenho para eles.

As propostas de mudar a interação do menu superior, fornecer o nome do deck
pela API e acrescentar dados existentes à prévia desktop aguardam resposta do
usuário. As alterações visuais em andamento e os testes executados não são
aceite da spec nem autorização para mudanças nessas propostas.

## Alteração aprovada para composição da mesa

O usuário substituiu a composição móvel da V2 por um campo focado por vez,
inicialmente o próprio, com mão sempre visível e sem rolagem da tela principal.
O controle de visão geral alterna entre a grade e o próprio campo; cada campo
da grade permite foco e, ao focar um adversário, há retorno direto ao próprio.
No desktop, o usuário pediu campos iguais e preenchendo o espaço disponível,
com exceção expressamente aprovada para três jogadores: dois oponentes acima e
o campo próprio ocupando a linha inferior. Para dois jogadores, são duas faixas
horizontais de mesma área; para quatro, uma grade de campos iguais. O usuário
decidiu remover o botão de ampliar no desktop. Essas decisões substituem as
composições correspondentes da spec V2, sem alterar dados ou regras de jogo.

## Revisão do mobile e do trilho

Na revisão, o usuário pediu manter a tela principal fixa a partir de 320 px,
com campo, mão e comandos acessíveis. Aprovou uma mão em leque com rolagem
horizontal interna e um trilho com alvos de toque maiores e rolagem interna
quando necessário. Depois pediu que a mão ocupe sozinha a faixa inferior e que
comprar, desvirar, passar turno e demais comandos fiquem em um botão flutuante.
Para preservar um trilho estreito, aprovou abrir os ajustes de vida no painel
do jogador ao tocar na vida. Pediu ainda comandante acima do grimório, ícones
maiores no desktop e remoção do atalho visual de fundo do grimório no campo;
o destino continua disponível nas ações e nos destinos de arraste da carta.

Na revisão seguinte, o usuário substituiu a faixa inferior reservada por uma
mão flutuante sobre o campo móvel. Pediu cartas um pouco maiores, leque
centralizado quando couber, deslizamento horizontal em mãos grandes e remoção
do botão de organizar no celular. A tela principal continua sem rolagem.

## Inspeção de cartas revisada

O usuário pediu que o clique abra diretamente a inspeção ilustrada, substituindo
o formulário anterior; pediu também mostrar as ações antes agrupadas em
“Outras ações” abaixo de Marcadores, manter a carta fixa durante a rolagem das
ações e ampliar a prévia de hover no desktop. A barra de seleção não deve
sobrepor a inspeção. Essas instruções substituem os requisitos anteriores de
clique para seleção e de menu plano. Seleção em lote permanece disponível pelo
modo Selecionar, Shift e seleção por área. A implementação aguarda 250 ms no
clique simples de mouse em cartas controladas no campo para preservar o duplo
clique de virar; esse intervalo é uma escolha de implementação, não uma medida
específica aprovada pelo usuário.

Na revisão posterior, o usuário pediu que a inspeção siga o layout do protótipo,
conservando o tamanho da carta e do modal: prévia dos marcadores, destinos e
transferência no próprio painel, e remoção de “Ocultar todas reveladas” desse
modal. Ao esclarecer a permissão de marcadores, decidiu manter a regra existente:
no campo apenas o controlador edita marcadores, mesmo quando outro jogador é
dono da carta; nas demais zonas aplica-se a permissão existente do dono. Os
marcadores públicos continuam visíveis para consulta sem alterar permissões.
