# Experiência mobile da mesa

## Autorização

Em 20/10/2026, o usuário solicitou uma branch nova, sem worktree, para corrigir
a experiência mobile: recolher mão e ações, navegar pela mão com arraste em
vez de setas, manter a leitura de cartas após toque longo e melhorar os painéis
de prévia, jogadores e registro. Autorizou liberdade artística e técnica no
layout e código para esses objetivos, com prints, conventional commits e PR
aberto para revisão. Essa autorização complementa a
[mesa compacta](31-mesa-compacta.md) e a
[especificação da mesa](../specs/02-mesa-e-interface.md).

## Implementação inicial em 20/10/2026

- Controle explícito para recolher/restaurar mão e ações, devolvendo espaço ao
  campo sem desmontar a mão.
- Navegação horizontal nativa por toque. “Organizar” separa a intenção de
  reordenar/jogar cartas da intenção de deslizar. Também é possível arrastar
  verticalmente da mão para o campo e ordenar por Alt + setas no teclado. A ordem visual é local à mesa
  aberta, sem alterar snapshot, contratos ou registro da partida.
- Toque longo fixa a carta no painel de prévia, que permanece após mover ou
  levantar o dedo. Toque curto continua abrindo os controles da carta.
- A faixa inferior e o zoom são compactados em paisagem.
- Abas mobile permanecem na mesma posição; conteúdo ocupa a largura do campo,
  com rolagem limitada ao painel e rolagem própria do registro.

Sem mudanças de banco, dependências, infraestrutura, autenticação ou regras.

## Validação

- Login real de `rafa` na aplicação local, com a senha corrigida pelo usuário.
  Prints revisados da sala 4 com quatro participantes em 320×740, 390×844,
  844×390, 820×1180 e 1440×900: mesa, jogadores, registro e mão recolhida;
  prévia persistente conferida com uma carta real. Sem alterar a partida.
  Arquivos locais ignorados em `app/test-results/local-*.png`.
- A revisão visual encontrou excesso de altura da mão e corte do zoom em
  paisagem; ambos foram corrigidos. A lista de jogadores usa altura natural
  limitada ao espaço disponível, evitando uma superfície vazia até o rodapé.
- Testes de navegador usam API Go/MySQL real e eventos nativos de toque via
  Chromium. Somente as imagens são controladas para manter a suíte independente
  de rede. Verificam deslize sem reordenar, organização por arraste, prévia
  após movimento/soltura, recolher/restaurar sem perder ordem, rolagem do
  registro, alternância de painéis, jogar por arraste e persistência da jogada
  após recarga. A ordem visual da mão dura até sair/recarregar a mesa.
- Testes existentes foram atualizados para navegar sem as setas removidas e
  abrir a aba específica. O cenário de pilhas passou a distribuir cartas
  diretamente no destino, evitando colisões transitórias com cartas que ainda
  seriam reposicionadas durante a preparação do teste.

## Resultados em 20/10/2026

- `npm run build --prefix app`: TypeScript e build passaram. Permanece o aviso
  de tamanho do chunk existente de `manaScene`.
- Regressões de `game-ui`, `ajustes-mesa`, `posicionamento` e `virar-selecao`:
  24 cenários passaram; 6 variantes omitidas por serem específicas de mouse
  ou da matriz desktop. Cobrem seis jogadores, orientação, menus, privacidade,
  leitura de novas entradas e movimentação/seleção de cartas.
- `mobile-table.spec.ts`, projetos `celular` e `celular-horizontal`:
  2 passaram na repetição final após o ajuste de espaçamento em paisagem.
  O teste aguarda a atualização da geometria ao recolher a mão.
- Links locais e `git diff --check`: passaram.

A validação de navegador é Chromium com emulação mobile; não é uma execução
em iPhone físico.
Sem alterações de backend, não foi repetida a suíte Go nem Docker.

## Refinamento aprovado em 21/10/2026: três controles flutuantes

O usuário considerou a apresentação anterior ainda poluída e pediu a mão
fechada, acessível por botão flutuante. Escolheu painel sobreposto, sem reduzir
o campo, e depois definiu três controles separados: mão; comandos com Passar
turno, Comprar, Desvirar todas e Ações; informações com Prévia, Jogadores e
Registro. Confirmou mão e comandos independentes e abas dentro do painel de
informações. Ao autorizar a implementação do plano, corrigiu explicitamente
a posição para o **canto inferior direito**.

A apresentação compacta, até 1000 px, começa com as três áreas fechadas.
Os botões ficam empilhados de baixo para cima: Mão, Comandos e Informações.
A mão é uma superfície inferior sobreposta e mantém ordem/rolagem ao fechar.
Comandos fica acima dela quando aberta; comprar, desvirar e passar turno não
fecham a mão. Informações e Comandos são mutuamente exclusivos, preservando
a mão por trás. Informações lembra a última aba e toque longo abre Prévia.
Menus e informações fecham por controle explícito, Escape ou toque externo
interceptado antes de atingir o campo. O zoom fica afastado dos flutuantes.

Passar turno sai do menu Ações e fica nos comandos rápidos também no desktop;
atalho N e operação HTTP permanecem iguais. O menu Ações conserva dado, moeda,
fichas e correção de turno. Não há alteração de contratos, dados ou dependências.

## Validação em 21/10/2026

O build do frontend passou. No desktop, no celular e no celular deitado, os
fluxos de mesa que abrem mão, comandos e registro pelos três botões passaram
contra a API Go/MySQL real. O arraste da mão até a coluna “Suas zonas” no
celular deitado ficou sem a repetição final: a suíte foi interrompida com a
máquina sobrecarregada. Os resultados de 20/10 acima continuam históricos da
versão anterior.
