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
