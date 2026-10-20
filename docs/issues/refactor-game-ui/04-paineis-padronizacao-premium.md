# 04: Painéis — padronização e acabamento premium

**What to build:** Reconhecer o mesmo padrão visual e de controles em
grimório, ações, jogador, fichas e detalhe da carta, com acabamento premium,
incluindo os novos editores diretos de vida e P/R.

**Blocked by:** [01 — Jogador: vida junto ao nome e edição direta](01-jogador-vida-direta.md) e [02 — Carta: edição direta de poder/resistência](02-carta-poder-resistencia-diretos.md).

**Status:** ready-for-agent

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Integra o [refactor local](README.md). O card de composição da mesa não é
bloqueio; esta entrega trata dos painéis e controles.

- [ ] Unificar cabeçalhos, ícones, tipografia, espaçamentos, raios, bordas e hierarquia de ações nos painéis da mesa, preservando a paleta original e cores funcionais.
- [ ] Aproveitar componentes existentes de painel, cabeçalho, item de comando e editor numérico onde há compartilhamento real, sem criar um sistema global ou abstrações para telas fora do escopo.
- [ ] Controles de vida e P/R entregues pelos cards 01 e 02 mantêm edição direta, formato aprovado e confirmação por Enter/perda de foco, sem reintroduzir etapas removidas.
- [ ] Cabeçalhos, rótulos e indicadores não repetem informação sem necessidade; ícones complementam texto ou têm nome acessível quando usados sozinhos.
- [ ] Foco, hover, desabilitado, envio e erro têm apresentação consistente; alvos de ação mantêm pelo menos 44 por 44 pixels e contraste legível.
- [ ] Menus permanecem verticais e compactos, ancorados à origem quando houver espaço e adaptados ao celular; consultas com várias cartas mantêm área de trabalho apropriada, sem impor tamanho único a todos os conteúdos.
- [ ] Painéis cabem e podem ser percorridos com teclado e toque, inclusive nas bordas, em 320/390, 768/1024 e 1280/1920 pixels e celular horizontal de pouca altura.
- [ ] Preservar fechamento, voltar, restauração de foco, confirmação incerta, consultas retomáveis e regras de revelação; não alterar outros fluxos nem permissões.
- [ ] Navegador com API real exercita abertura/fechamento, comandos e consultas nos painéis, incluindo os editores novos. Testar também falhas e navegação por teclado sem substituir sucessos do servidor por respostas fabricadas.
- [ ] Produzir e revisar prints de grimório, ações, jogador, carta e fichas nas categorias de tela, com movimento reduzido respeitado; registrar resultados reais e limitações.
