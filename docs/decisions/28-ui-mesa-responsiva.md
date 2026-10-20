# Mesa responsiva e padrão de menus

Issue: [21 — Refatorar a UI da mesa](../issues/21-refatorar-ui-mesa.md).

## Proposta e aprovação explícita

Em 19/10/2026, o usuário pediu uma mesa mais intuitiva e com aparência de jogo,
padronização de menus, ícones, ações rápidas maiores ao lado da mão e remoção
do bloqueio em celular vertical. A conversa usou a skill `grilling` para
refinar as decisões antes de implementar.

O usuário aprovou a direção de mesa de fantasia com interface limpa, playmat
escuro, detalhes arcanos discretos e destaque nas cartas. Limitou o escopo à
mesa e seus fluxos: lobby, decks e demais telas serão reformulados depois.

Após investigação, aprovou explicitamente:

- Menus verticais compactos com ícone e texto, ancorados no elemento clicado
  no desktop e apresentados como painel inferior em telas estreitas. Consultas
  com várias cartas usam um espaço de trabalho maior com o mesmo padrão visual.
- Grimório concentra suas operações; o menu Ações deixa de repetir comprar,
  grimório e embaralhar. Vida e marcadores passam para o menu do jogador.
- Card do jogador abre seu menu; um botão separado troca o campo observado.
  Cada um edita apenas sua própria vida/marcadores. Dados públicos dos outros
  jogadores permanecem disponíveis somente para leitura.
- Visão geral com mesas reduzidas, como uma grade de videochamada. No celular,
  começa no próprio campo; tocar numa miniatura amplia a mesa e Visão geral
  retorna à grade. Miniaturas mobile servem para observar/escolher foco;
  manipulação acontece no campo ampliado. A mão própria permanece disponível.
- Detalhe de carta com imagem/identificação, ações rápidas, ajustes e outras
  ações. P/R é identificado como modificador manual, disponível para qualquer
  carta. Mover para zonas passa a ter acesso explícito no detalhe.
- Destaques de turno/foco, prévia vazia compacta, registro que preserva a leitura,
  estados visuais consistentes e animações curtas com movimento reduzido.

À síntese final dessas decisões, o usuário respondeu **“prossiga com a
implementação, siga padroes do repositorio e tire prints para conferir e
revisra seu trabalho”**. Depois atribuiu a branch **`refactor/game-ui`**.

Esta autorização substitui os requisitos antigos de bloquear portrait e os
acessos de menus descritos nas decisões [10](10-interface-do-grimorio.md),
[12](12-vida-e-contadores.md), [22](22-ajustes-da-mesa.md) e
[27](27-duplo-clique-na-selecao.md), somente quanto à apresentação/navegação.
Contratos, privacidade, permissões, estados e gestos de jogo permanecem.

## Implementação

Frontend em React/CSS, sem novas dependências, fontes externas ou mudança de
API, banco, autenticação, transporte ou coordenadas persistidas. Ícones SVG
locais e superfícies de playmat em CSS. Componentes compartilhados de painel,
cabeçalho e item de comando cuidam dos menus de jogo, grimório, jogador e fichas;
o detalhe da carta reutiliza cabeçalho e comandos.

Desktop apresenta campos completos na visão conjunta com até dois jogadores;
com três a seis usa a mesma grade de miniaturas para evitar campos cortados.
Em ambos os casos, ampliar dá acesso ao campo com seus controles completos.

Painéis se ajustam às bordas e ao viewport visual, têm fechamento por Escape,
clique externo e botão, navegação por teclado e restauração de foco. Consultas
privadas continuam sendo retomáveis. O detalhe mantém as regras de revelação
ao fechar e a recuperação de intenções sem confirmação.

Ambiente local existente: frontend em `http://localhost:8080`, API em `/api`
na mesma origem e MySQL em `127.0.0.1:3307`. Testes de navegador usam executável
Go e MySQL descartável; não recebem a URL ou as contas do banco de uso pessoal.

## Verificação

Verificações executadas nesta entrega, em 19/10/2026:

- Build e TypeScript passaram, assim como os três testes unitários dos gestos
  e atalhos. O build mantém o aviso preexistente do chunk Three.js do login
  acima de 500 kB; o login não foi reformulado.
- A regressão ampla de navegador teve 93 cenários aprovados, 22 omitidos e
  duas falhas investigadas: o teste de arraste continuava usando coordenadas
  de uma carta fora da área visível após girar; no horizontal, o menu Ações
  podia interceptar o acesso ao registro na barra superior.
- Após trazer a origem do gesto para a área visível, os dois cenários de
  posicionamento por toque passaram em `test-results/position-review`.
  O painel foi limitado ao espaço abaixo da barra superior; os 16 cenários
  de `game-ui.spec.ts` e `salas.spec.ts` passaram nas três variantes, com duas
  omissões da matriz adicional de larguras já exercitada no desktop.
  Resultado em `test-results/panels-review`.
- A revisão posterior das miniaturas desktop passou 12 cenários de prévia,
  revelação, finalização, navegação entre seis jogadores, jogador, carta,
  teclado, leitura do registro, larguras e transferência de controle.
  Resultado em `test-results/desktop-review`.
- Os fluxos usam API Go e MySQL reais e descartáveis, incluindo reenvio de
  intenção sem confirmação, visibilidade e recuperação após recarga. Somente
  as imagens das cartas são controladas; a revisão visual usa uma imagem
  real fornecida por arquivo local opcional `UI_CARD_IMAGE`.
- Foram revisadas capturas de mesa, grimório, ações, jogador, detalhe da carta
  e visão geral. A revisão encontrou e corrigiu CSS antigo que alargava o menu,
  miniaturas sem largura, campos desktop cortados e distribuição da seleção
  no grimório horizontal. As capturas definitivas ficam em
  `app/test-results/ui-review/`, com animações concluídas na captura. A geração
  definitiva repetiu o fluxo completo com seis jogadores e passou nas três
  variantes de tela, incluindo o ajuste que preserva a barra superior.
- Links locais dos documentos alterados e `git diff --check` foram conferidos.
  Frontend local retornou HTTP 200 e API sem sessão retornou HTTP 401,
  conforme a proteção existente. Hot reload do Vite aplicou os arquivos.

Os testes opt-in de Docker/hot reload e validações manuais com credenciais
locais não foram executados. Não foram repetidos suíte Go, smoke Docker de
produção ou smoke do provedor de imagens: backend, infraestrutura e provedor
permanecem os existentes. Resultados das decisões anteriores são históricos
e não validam esta entrega.

Seleção múltipla por toque e ações coletivas entre zonas continuam nas
pendências das issues 09 e 18; esta reformulação não declara essas issues
concluídas.
