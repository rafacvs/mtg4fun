# 03: Mesa — composição premium mobile-first

**What to build:** Jogar em uma mesa visualmente cuidada e condizente com
Magic em celular, dispositivos médios e desktop, com proporções equilibradas
entre campo, zonas, mão, ações rápidas, prévia e registro, sem mudar os fluxos.

**Blocked by:** Nenhum (pode começar imediatamente).

**Status:** ready-for-agent

Requisitos: [spec do refinamento](../../specs/04-refinamento-ui-mesa.md).
Integra o [refactor local](README.md).

- [ ] Preservar os tokens da paleta original da master e as cores funcionais; não reintroduzir superfícies verdes como tema principal.
- [ ] Usar detalhes temáticos suaves, texturas e profundidade sutis, mantendo cartas e informações como foco, sem ornamentos pesados ou animações excessivas.
- [ ] Reequilibrar campo, zonas laterais, mão, ações rápidas, prévia e registro para reduzir espaço desperdiçado e rolagem desnecessária sem esconder conteúdo nem reduzir alvos de toque.
- [ ] Não modificar coordenadas persistidas, fileiras, zoom, pilhas ou gestos de jogo para acomodar o layout; cartas fora da área visível continuam alcançáveis.
- [ ] Preservar visão geral de até seis jogadores, foco individual e mão própria ao observar oponente; nenhuma ação troca de identidade ou permissão.
- [ ] Validar larguras de 320, 390, 768, 1024, 1280 e 1920 pixels com alturas representativas, além de celular horizontal de pouca altura e mudança de orientação durante a partida.
- [ ] Não há rolagem horizontal da página nem cortes de comandos; rolagens internas necessárias permanecem utilizáveis, incluindo mão cheia e todas as zonas.
- [ ] Preservar posição de leitura do registro, prévia, atalhos, alvos de ação de pelo menos 44 por 44 pixels e preferência por movimento reduzido.
- [ ] Fluxos de navegador com API real exercitam comprar, consultar grimório, mover/virar cartas, acessar painéis, navegar pela mão e trocar foco com mouse/toque; conferir que reposicionamento sobrevive à recarga.
- [ ] Produzir e revisar prints da mesa e visão geral nas categorias de tela, registrar problemas encontrados e correções; conferir jogabilidade, não apenas aparência.
- [ ] Mudanças ficam restritas à mesa, sem redesign de lobby/decks/login, novas dependências ou alteração de backend.
