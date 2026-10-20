# 04: Painéis — padronização e acabamento premium

**What to build:** Reconhecer o mesmo padrão visual e de controles em
grimório, ações, jogador, fichas e detalhe da carta, com acabamento premium,
incluindo os novos editores diretos de vida e P/R.

**Blocked by:** [01 — Jogador: vida junto ao nome e edição direta](01-jogador-vida-direta.md) e [02 — Carta: edição direta de poder/resistência](02-carta-poder-resistencia-diretos.md).

**Status:** implementado

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Integra o [refactor local](README.md). O card de composição da mesa não é
bloqueio; esta entrega trata dos painéis e controles.

- [x] Unificar cabeçalhos, ícones, tipografia, espaçamentos, raios, bordas e hierarquia de ações nos painéis da mesa, preservando a paleta original e cores funcionais.
- [x] Aproveitar componentes existentes de painel, cabeçalho, item de comando e editor numérico onde há compartilhamento real, sem criar um sistema global ou abstrações para telas fora do escopo.
- [x] Controles de vida e P/R entregues pelos cards 01 e 02 mantêm edição direta, formato aprovado e confirmação por Enter/perda de foco, sem reintroduzir etapas removidas.
- [x] Cabeçalhos, rótulos e indicadores não repetem informação sem necessidade; ícones complementam texto ou têm nome acessível quando usados sozinhos.
- [x] Foco, hover, desabilitado, envio e erro têm apresentação consistente; alvos de ação mantêm pelo menos 44 por 44 pixels e contraste legível.
- [x] Menus permanecem verticais e compactos, ancorados à origem quando houver espaço e adaptados ao celular; consultas com várias cartas mantêm área de trabalho apropriada, sem impor tamanho único a todos os conteúdos.
- [x] Painéis cabem e podem ser percorridos com teclado e toque, inclusive nas bordas, em 320/390, 768/1024 e 1280/1920 pixels e celular horizontal de pouca altura.
- [x] Preservar fechamento, voltar, restauração de foco, confirmação incerta, consultas retomáveis e regras de revelação; não alterar outros fluxos nem permissões.
- [x] Navegador com API real exercita abertura/fechamento, comandos e consultas nos painéis, incluindo os editores novos. Testar também falhas e navegação por teclado sem substituir sucessos do servidor por respostas fabricadas.
- [x] Produzir e revisar prints de grimório, ações, jogador, carta e fichas nas categorias de tela, com movimento reduzido respeitado; registrar resultados reais e limitações.

## Verificação

Em 19/10/2026, na branch `refactor/game-ui`:

- `npm run build` em `app/` passou.
- `npx playwright test tests/e2e/game-ui.spec.ts tests/e2e/contadores.spec.ts tests/e2e/grimorio.spec.ts tests/e2e/fichas.spec.ts` terminou com 37 aprovados e 2 ignorados. Os ignorados são a matriz de larguras fora do desktop. Vida, poder/resistência, falha parcial e confirmação incerta passaram em desktop, celular e celular horizontal. Com movimento reduzido, os painéis ficam com `animation-name: none`.
- Revisão visual em `http://127.0.0.1:8080` em 320×700, 390×844, 768×1024, 1280×800 e 844×390. Ações, jogador, carta e grimório couberam na tela, sem rolagem da página. Os botões de vida mediram 44×44 px. O detalhe editável não repete o chip de poder/resistência. O catálogo de fichas, buscado por “soldier”, lista resultados e o botão Criar no painel compacto, também no celular.

Exceção de tamanho: o grimório com cartas abertas e o detalhe da carta continuam maiores que o menu de ações, porque a lista e a arte precisam de área própria. Fichas, ações e jogador usam a coluna compacta. No celular horizontal baixo, o menu de ações rola por dentro quando não cabe a lista inteira.
