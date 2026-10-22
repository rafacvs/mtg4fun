# 21: Refatorar a interface da mesa e seus fluxos

**What to build:** Mesa de fantasia com interface limpa, responsiva em ambas as
orientações, menus consistentes e comandos fáceis de localizar.

**Status:** implementado na branch `refactor/game-ui`, preparado para revisão por PR.

Escopo e aprovação explícita: [decisão 28](../decisions/28-ui-mesa-responsiva.md).
Requisitos: [mesa e interface](../specs/02-mesa-e-interface.md).

- [x] Jogar em celular vertical/horizontal sem bloqueio por orientação.
- [x] Visão geral mobile com até seis mesas reduzidas e toque para ampliar,
  mantendo mão e ações próprias ao observar qualquer participante.
- [x] Menus verticais com ícone/texto, dimensões e cabeçalhos compartilhados,
  ancorados à origem no desktop e painel inferior em telas estreitas.
- [x] Consulta do grimório com espaço maior, mantendo seleção, ordenação,
  devolução, retomada e visibilidade privada/pública.
- [x] Ações sem duplicatas de grimório/compra/embaralhamento ou vida/marcadores.
- [x] Vida/marcadores no card/cabeçalho do jogador, respeitando permissões;
  foco do campo com acesso separado.
- [x] Comandos rápidos com ícones; refinamento mobile posterior com três
  botões flutuantes no canto inferior direito, conforme a
  [decisão 34](../decisions/34-experiencia-mobile.md).
- [x] Detalhe da carta padronizado, com estados, comandos agrupados,
  modificadores de P/R claros e destinos explícitos para movimento.
- [x] Playmat, cores de zonas, foco, turno, seleção e arraste coerentes;
  movimento reduzido, prévia vazia compacta e registro sem interromper leitura.
- [x] Fluxos reais de navegador com mouse/toque, capturas revisadas e
  documentação atualizada; lobby, decks, backend e dados pessoais preservados.

Seguir [AGENTS.md](../../AGENTS.md) e a [estratégia de testes](../testing.md).
