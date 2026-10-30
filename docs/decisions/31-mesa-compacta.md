# Mesa compacta e painéis recolhíveis

## Pedido e aprovação explícita

Em 20/10/2026, o usuário pediu nesta conversa ajustar a mesa na branch atual,
sem criar worktrees: navbar e mão compactas; prévia, jogadores e registro
com abas recolhíveis próprias; remoção dos avatares; clique de vida/marcadores
restrito ao nome/vida; lateral mais estreita; zoom vertical no canto inferior
direito; botão de ampliar alternando foco/visão geral, sem botão adicional no
topo. Autorizou outros refinamentos visuais para favorecer visibilidade e campo.
Pediu validar com prints, priorizando os ajustes visuais sem suíte ou build completo.

## Implementação

A navbar mantém lobby, sala/observação, turno e finalização. Cada painel tem
seu controle local com estado acessível de expansão. Desktop permite combinar
painéis; até 1000 px as abas ficam acima do campo e abrem um painel por vez,
para não sobrepor vários conteúdos. Abrir outro campo recolhe os painéis nessa
composição. Após o feedback complementar abaixo, a rolagem fica na coluna
inteira; prévia e jogadores não têm rolagem interna. O registro mantém uma
área de leitura mínima de 220 px e rolagem própria para as entradas. Os alvos de toque permanecem com
44 px; mouse permite botões mais compactos na navbar e ações da mão.

Sem mudanças de dependências, contratos, dados, regras ou infraestrutura.
A autorização é de apresentação e dos controles citados, complementando a
[decisão 29](29-refinamento-ui-mesa.md). O posicionamento segue a
[decisão 30](30-grade-do-campo.md).

## Verificação desta alteração

Navegador Chromium contra a aplicação Go/MySQL local existente, sem semear ou
alterar partidas: consulta da sala de quatro participantes, abrir/fechar painéis,
menu do jogador pelo nome/vida, clique inerte no espaço vazio do cabeçalho,
foco/visão geral, mão preservada e capturas em 320×740, 390×844, 820×1180,
844×390, 1280×720, 1440×900 e 1920×1080. Sem erro JavaScript observado ou
rolagem horizontal da página nessas medidas. Capturas em
`app/test-results/clean-*.png` (artefatos locais ignorados pelo Git).
A revisão visual identificou e corrigiu corte da imagem da prévia em 720 px
de altura, permitindo rolagem da lista de jogadores.

Os seletores dos testes existentes dos controles alterados foram ajustados.
`npm run typecheck --prefix app` passou. A suíte automatizada e o build
completo não foram executados, conforme a
prioridade pedida pelo usuário. Esta verificação não declara regressão completa.
Mantido o trabalho local na branch atual, conforme orientação registrada nos
[cards](../issues/refactor-game-ui/README.md).

## Feedback complementar aprovado e implementado

Na sequência da revisão visual de 20/10/2026, o usuário pediu explicitamente:

- Cabeçalho do campo mais fino e minimalista, com retorno à própria mesa à
  esquerda do botão de ampliar quando estiver observando um oponente.
- Rolagem dedicada à coluna de painéis. Todos os jogadores devem estar
  expandidos na lista, sem scroll próprio; a prévia também não tem scroll
  interno. O registro tem altura mínima legível e scroll interno independente.
- Clicar no foco do jogador já observado na lateral retorna à visão geral.

O cabeçalho usa controles discretos de 28 px com mouse no desktop e mantém
44 px para toque. O retorno à própria mesa preserva a mão e o foco ampliado.
A coluna não comprime os painéis: prévia e lista ocupam sua altura natural,
e o painel de registro reserva pelo menos 284 px (área de entradas de 222 px
nas medidas verificadas). Quando o conjunto não cabe, a coluna inteira rola.
A atividade recente continua destacada sem forçar a rolagem da coluna.
Em telas compactas, abrir uma aba mostra a coluna sobre o campo, com a mesma
rolagem externa, mantendo um conteúdo aberto por vez.

Verificação deste feedback: Chromium contra a API/MySQL local existente,
sala com quatro participantes, sem modificar a partida. Conferidos retorno
à própria mesa, ausência desse botão na própria mesa, alternância de foco
pela lateral e cabeçalho, rolagens e ausência de erro JavaScript. Capturas em
1440×900, 1280×720, 1823×995, 390×844 e 844×390 salvas como
`app/test-results/refined-*.png`. Prévia e lista sem overflow interno;
área de entradas do registro com 222 px nas três medidas desktop; rolagem
externa presente com os três painéis abertos. TypeScript passou.
O cenário existente de navegador com seis participantes foi ampliado para
cobrir os novos controles e a geometria das rolagens; essa suíte não foi
executada neste feedback, preservando o foco na revisão visual solicitado.

## Acabamento do bloco de identidade

Após aprovar os ajustes anteriores, o usuário pediu deixar especificamente o
nome, a indicação de mesa própria e a vida mais organizados, minimalistas e
premium. O cabeçalho agora separa o nome da etiqueta discreta “Você”, usa um
divisor sutil antes da vida, número com maior peso e coração dourado menor.
A seta do menu foi reduzida e aponta para baixo; o turno usa ponto dourado e
texto secundário. O clique continua restrito ao bloco de identidade.

Revisão visual desta alteração em Chromium com a aplicação local existente:
1440×900, 390×844 e 320×740; capturas `app/test-results/header-polish-*.png`.
Conferidos cabeçalho próprio e de oponente, abertura do menu pelo bloco,
clique inerte no espaço vazio, retorno à própria mesa disponível no oponente
e ausência de rolagem horizontal da página ou erro JavaScript.
Altura preservada em 28 px com mouse no desktop e 44 px no celular.
`npm run typecheck --prefix app` passou. Sem build ou suíte completa.

## Zoom compacto e afastado das barras de rolagem

O usuário pediu reduzir os botões de zoom e movê-los para dentro do campo,
liberando a barra de rolagem. Os botões passam a 28×28 px para mouse, com
contêiner menor e afastamento de 24 px das bordas inferior e direita do campo.
Para toque, mantêm 44×44 px. O zoom e seus limites permanecem iguais.

Verificado em Chromium com a aplicação local: aumentar/diminuir zoom,
rolagem horizontal e vertical presentes no campo a 250%, botões de 28 px
com 16 px livres até as bordas da área de rolagem; desktop 1440×900 e
horizontal 844×390. Celular com toque 390×844 mantém alvos de 44 px.
Capturas `app/test-results/zoom-compact-*.png`, incluindo detalhe das barras
visíveis. Sem build ou suíte completa para este ajuste de CSS.

## Padronização das zonas laterais

O usuário pediu explicitamente padronizar comandante, grimório, cemitério e
exílio: quantidade no canto superior direito com fundo escurecido, nome
somente na faixa inferior e ícones nas zonas vazias. As referências pedidas
foram crown, book-open, skull e orbit, respectivamente, preferindo o sistema
de ícones existente.

As quatro zonas usam o mesmo componente de rótulo/contador. O grimório não
tem mais cabeçalho com nome e quantidade acima da pilha; sua faixa inferior
segue o mesmo padrão. O destino “Fundo” permanece separado e funcional.
Zonas vazias mostram o ícone, sem o texto “Vazio”; o grimório vazio mostra
livro aberto em vez de uma pilha fictícia. Os ícones foram adicionados ao
`TableIcon` SVG existente, reutilizando a coroa, sem nova dependência.
Os nomes acessíveis das zonas e contagens foram preservados.

Validação desta alteração: TypeScript passou. Chromium com a aplicação local
em 1440×900, 390×844 e 844×390; conferidos quatro contadores, posição no canto,
nomes inferiores, ausência do cabeçalho do grimório, pilha com três imagens
e abertura de suas ações. Sem alteração da partida. Para revisar visualmente
todos os ícones vazios, foi usado um snapshot controlado somente no navegador,
sem gravação no servidor; essa captura não comprova esvaziamento pela API.
Capturas em `app/test-results/zones-standard-*.png`. Sem build ou suíte completa.

## Contagem da mão e emblemas das zonas

Em 30/10/2026, o usuário pediu mover a contagem de cartas da mão para o
cabeçalho de cada jogador, junto ao nome, e destacar grimório, cemitério e
exílio com ícones maiores e centralizados e a contagem em uma pequena bolha
circular. A mudança é de apresentação; a privacidade do conteúdo da mão e as
cartas do topo visíveis nas zonas públicas permanecem.

A contagem usa o ícone de mão ao lado do nome nos cabeçalhos. A coluna de zonas
deixa de repetir a mão. Grimório, cemitério e exílio recebem emblemas centrais
e contadores circulares; nas faixas compactas do celular, os emblemas continuam
visíveis em alvos de zona maiores e roláveis.

## Acabamento seguinte da mão

Em 30/10/2026, o usuário pediu retirar os subtítulos “Você” e “Mão privada”
dos cabeçalhos, remover “Organizar”, deixar as cartas da mão um pouco mais
visíveis sobre o campo, e trocar a ordem ao soltar uma carta em qualquer ponto
de outra. Também pediu reduzir em 50% o tempo de hover para abrir o preview.

Os subtítulos e o modo/botão de organização foram removidos. Sobrepor uma carta
a outra troca suas posições; soltar no espaço entre cartas mantém a inserção
por posição. A mão sobe discretamente: a carta mostra 43% da altura em repouso,
antes 40%, e fica alguns pixels sobre a borda do campo. O preview por hover abre
em 375 ms, antes 750 ms. O selo de turno mantém sua posição no canto direito e
seu estilo original. O botão de centralizar zoom alinha com o topo visível do
campo, acima da margem interna reservada à faixa do jogador.

Em seguida, o usuário pediu um recuo superior igual ao recuo lateral, a tag de
vez junto dos controles à direita e um pin por campo para alternar entre foco
exclusivo e visão geral. Os controles usam 2 px de recuo superior e lateral;
da esquerda para a direita ficam pin, ajuste do campo e tag de vez (quando
aplicável). O pin alterna entre o campo próprio ou de qualquer adversário e a
visão geral. No desktop, o foco mostra somente o campo escolhido; no celular,
os controles de foco existentes continuam disponíveis.

Verificação: `docker compose exec -T app npm run build` passou, incluindo
TypeScript. Um teste Playwright Chromium com API e MySQL descartáveis confirmou
a ausência do botão/subtítulos, a troca ao soltar no canto da carta-alvo, a
altura da mão, controles no topo direito e ausência de erros JavaScript. Outro
cenário com dois jogadores confirmou foco no campo próprio e adversário e o
retorno à visão geral. Captura inspecionada em
`app/test-results/game-ui-mão-zonas-e-contro-c4593-em-corretamente-em-Chromium-desktop/mesa-mao-e-zonas.png`.
O cenário mais amplo `posicionamento.spec.ts` confirmou a troca da ordem, mas
terminou com timeout numa etapa posterior de reposicionamento de cartas no
campo (linha 161); essa etapa não é a ordenação da mão. Não foi alterado o banco
pessoal. Trabalho permanece local, sem commit ou push.

## Campos sem espaçamento externo

Em 30/10/2026, o usuário pediu remover o espaço entre campos e entre a barra
superior, os campos e a mão para aproveitar a área disponível. No layout
desktop, os campos ficam contíguos; a área da mesa começa logo abaixo da barra
e a mão começa logo após os campos. O painel lateral mantém uma separação
estreita própria quando aberto. Os espaçamentos de toque e segurança do layout
mobile foram preservados.

Verificação: build e TypeScript passaram. Um teste Playwright Chromium com dois
jogadores conferiu limites contíguos entre barra/campo, campos/campos e
campo/mão. Captura inspecionada em
`app/test-results/game-ui-o-pin-foca-qualquer-campo-e-retorna-à-visão-geral-desktop/campos-sem-gaps.png`.

Após revisar a captura, o usuário pediu uma margem pequena à esquerda e abaixo
para revelar as bordas externas nesses cantos. O layout desktop agora reserva
3 px nesses dois lados; os campos continuam encostados entre si, na barra e na
mão. Após feedback, a etiqueta “Sua mão” ganhou mais recuo à esquerda, largura
mínima e fica acima das cartas para não ser encoberta. Build e teste Chromium
passaram; a geometria confirma os recuos e a etiqueta permanece visível dentro
da barra.
