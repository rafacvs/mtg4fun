# 03: Mesa — composição premium mobile-first

**What to build:** Jogar em uma mesa visualmente cuidada e condizente com
Magic em celular, dispositivos médios e desktop, com proporções equilibradas
entre campo, zonas, mão, ações rápidas, prévia e registro, sem mudar os fluxos.

**Blocked by:** Nenhum (pode começar imediatamente).

**Status:** implementado

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Integra o [refactor local](README.md).

- [x] Preservar os tokens da paleta original da master e as cores funcionais; não reintroduzir superfícies verdes como tema principal.
- [x] Usar detalhes temáticos suaves, texturas e profundidade sutis, mantendo cartas e informações como foco, sem ornamentos pesados ou animações excessivas.
- [x] Reequilibrar campo, zonas laterais, mão, ações rápidas, prévia e registro para reduzir espaço desperdiçado e rolagem desnecessária sem esconder conteúdo nem reduzir alvos de toque.
- [x] Não modificar coordenadas persistidas, fileiras, zoom, pilhas ou gestos de jogo para acomodar o layout; cartas fora da área visível continuam alcançáveis.
- [x] Preservar visão geral de até seis jogadores, foco individual e mão própria ao observar oponente; nenhuma ação troca de identidade ou permissão.
- [x] Validar larguras de 320, 390, 768, 1024, 1280 e 1920 pixels com alturas representativas, além de celular horizontal de pouca altura e mudança de orientação durante a partida.
- [x] Não há rolagem horizontal da página nem cortes de comandos; rolagens internas necessárias permanecem utilizáveis, incluindo mão cheia e todas as zonas.
- [x] Preservar posição de leitura do registro, prévia, atalhos, alvos de ação de pelo menos 44 por 44 pixels e preferência por movimento reduzido.
- [x] Fluxos de navegador com API real exercitam comprar, consultar grimório, mover/virar cartas, acessar painéis, navegar pela mão e trocar foco com mouse/toque; conferir que reposicionamento sobrevive à recarga.
- [x] Produzir e revisar prints da mesa e visão geral nas categorias de tela, registrar problemas encontrados e correções; conferir jogabilidade, não apenas aparência.
- [x] Mudanças ficam restritas à mesa, sem redesign de lobby/decks/login, novas dependências ou alteração de backend.

## Verificação

Em 19/10/2026, na branch `refactor/game-ui`:

- `npm run build` em `app/` passou.
- `npx playwright test tests/e2e/game-ui.spec.ts` passou: 7 testes e 2 ignorados. A matriz de 320, 390, 768, 1024, 1280, 1920 e 844×390 só roda no desktop e passou de novo depois do ajuste das duas mesas lado a lado entre 1001 e 1099 px.
- `posicionamento.spec.ts` e `estados.spec.ts` no desktop passaram. `mesa.spec.ts` e `grimorio.spec.ts` nas três variantes: 19 passaram e 2 foram ignorados.
- Revisão visual em `http://127.0.0.1:8080` em 320×568, 390×844, 768×1024, 1024×768, 1280×800, 1920×1080 e 844×390. Sem rolagem da página. Ações rápidas mediram pelo menos 44×44 px. Comprar, abrir o grimório e mover uma Island para o campo funcionaram; a carta continuou no campo depois de recarregar.

Correção na revisão: em 1024×768 as duas mesas empilhavam e o campo ficava com cerca de 173 px de altura. A grade passou a usar colunas de 280 px nessa faixa, e o campo medido ficou com 431 px.

Limite: com cerca de 390 px de altura, comando, grimório, cemitério e exílio não cabem juntos; a coluna de zonas rola por dentro. No celular estreito, o registro aberto cobre o campo e deixa a mão livre. Com seis jogadores, a lista do registro rola por dentro para o texto continuar legível. A visão geral em miniatura, com dois jogadores, aparece no celular; no desktop largo os dois campos ficam lado a lado.
