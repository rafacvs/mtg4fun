# Execução da paridade visual V2

**Estado:** decomposição publicada em 25/10/2026 por pedido explícito posterior
à publicação da spec. Implementação das tarefas e aceite visual pendentes.
A fonte de requisitos é a [spec #70](https://github.com/rafacvs/mtg4fun/issues/70),
com [versão fixada](https://github.com/rafacvs/mtg4fun/blob/170a87f10caa5f11708429ad0890df9c1cdde5bb/docs/specs/07-paridade-visual-v2.md).
Este plano organiza a execução; não altera os requisitos aprovados.

## Referência que deve acompanhar cada tarefa

**[HTML V2](https://github.com/rafacvs/mtg4fun/blob/170a87f10caa5f11708429ad0890df9c1cdde5bb/docs/redesign/mock-iterativo-v2.html) é o alvo visual obrigatório,
não uma inspiração.** Abrir o arquivo em navegador com JavaScript e observar
as pranchas antes de implementar. A página de código no GitHub não é uma
renderização da proposta. O [PDF V2](https://github.com/rafacvs/mtg4fun/blob/170a87f10caa5f11708429ad0890df9c1cdde5bb/docs/redesign/proposta-nova-experiencia-v2.pdf)
é complementar. Ambos estão versionados no commit fixado, cuja incorporação à
master foi proposta no [PR 71](https://github.com/rafacvs/mtg4fun/pull/71).
Não fazer merge desse PR automaticamente para começar uma tarefa: os links
fixados permitem consultar os documentos mesmo enquanto aguarda revisão.

Prevalecem as [exceções aprovadas](https://github.com/rafacvs/mtg4fun/blob/170a87f10caa5f11708429ad0890df9c1cdde5bb/docs/decisions/paridade-visual-v2.md):
campo manual sem fileiras obrigatórias ou pilhas automáticas, carta inteira
no campo/mão/leitura, conteúdo real e adaptações para telas e 2–6 jogadores.
Fundos podem se repetir para cinco/seis, sem repetir identidade de jogador.
Não interpretar essas exceções como dispensa da moldura/composição V2.

## Tarefas e ordem de execução

Todas são subissues nativas da #70, com `ready-for-agent` e bloqueios nativos
no GitHub. O rótulo significa especificada; uma tarefa com bloqueadores abertos
ainda não está liberada para execução. A primeira tarefa disponível é a #72.

| Tarefa | Resultado | Bloqueada por | Histórias da spec |
| --- | --- | --- | --- |
| [72](https://github.com/rafacvs/mtg4fun/issues/72) | preparar cenários e comparação reproduzível com o HTML V2 | Nenhum | 1, 2, 50, 51, 52 |
| [73](https://github.com/rafacvs/mtg4fun/issues/73) | aplicar fundos, fontes e acabamento extraídos do protótipo V2 | #72 | 16, 17, 18, 19 |
| [74](https://github.com/rafacvs/mtg4fun/issues/74) | reproduzir mesa desktop V2 com trilhos e ordem espacial correta | #73 | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 49 |
| [75](https://github.com/rafacvs/mtg4fun/issues/75) | reproduzir foco e crônica desktop das pranchas V2 | #74 | 25, 26, 27, 30, 31, 32 |
| [76](https://github.com/rafacvs/mtg4fun/issues/76) | reproduzir mão, doca e acesso às ações conforme V2 | #74 | 33, 34, 35, 36, 37, 41, 47, 48 |
| [77](https://github.com/rafacvs/mtg4fun/issues/77) | reproduzir prévia desktop e painel de leitura móvel da V2 | #75, #76 | 24, 28, 29, 43, 44, 49 |
| [78](https://github.com/rafacvs/mtg4fun/issues/78) | reproduzir mesa e foco no celular horizontal V2 | #75, #76, #77 | 38, 39, 45 |
| [79](https://github.com/rafacvs/mtg4fun/issues/79) | reproduzir faixas, seleção, foco e leitura no celular vertical V2 | #78 | 40, 41, 42, 43, 44, 45, 46 |
| [80](https://github.com/rafacvs/mtg4fun/issues/80) | garantir continuidade, acessibilidade e operações preservadas na V2 | #79 | 3, 17, 18, 20, 21, 22, 23, 24, 27, 36, 37, 45, 46, 47, 48, 49, 52 |
| [81](https://github.com/rafacvs/mtg4fun/issues/81) | entregar aceite visual integrado dos nove estados V2 | #80 | Todas (aceite integrado) |

As tarefas #75 e #76 ficam disponíveis após #74; ambas devem estar concluídas
antes de #77. A sequência restante mantém explícitas as dependências das
superfícies compartilhadas. O corpo de cada issue contém escopo executável,
pranchas, exceções, testes e critérios de aceite. Não duplicar esses corpos em
notas locais divergentes. As 52 histórias têm cobertura nas tarefas #72–#80;
a #81 revisa o conjunto, sem adiar para ela o acabamento das tarefas visuais.

## Rastreabilidade das nove telas

Os IDs abaixo são estados do protótipo V2, não versões dos documentos.

| Estado e título exato da prancha HTML | Entrega responsável | Viewport CSS e evidência |
| --- | --- | --- |
| V1 — Mesa em quadrantes · 4 jogadores | #73, #74 e #76 | Comparativo em 1440×900 e composição em 1366×768. |
| V2 — Foco · ampliar um oponente | #75 | Comparativo em 1440×900 e verificação em 1366×768. |
| V3 — Leitura · prévia ao passar o mouse | #77 | Comparativo em 1440×900 e verificação em 1366×768. |
| V4 — Crônica aberta · grade se ajusta | #75 | Comparativo em 1440×900 e verificação em 1366×768. |
| V5 — Celular horizontal · quatro campos | #78 | Comparativo em 844×390, interação por toque. |
| V6 — Celular horizontal · foco em um oponente | #78 | Comparativo em 844×390 e botão de foco visível. |
| V7 — Celular vertical · faixas e carta selecionada | #76 e #79 | Comparativo completo em 390×844 e seleção real. |
| V8 — Celular vertical · faixa expandida | #79 | Comparativo em 390×844, expandir/voltar por toque. |
| V9 — Celular vertical · ler carta de oponente | #77 e #79 | Painel em #77; composição completa em #79, 390×844. |

#72 prepara captura de referência e dados descartáveis; #80 fecha regressões,
adaptações e acessibilidade; #81 entrega e submete todos os comparativos.
“Antes” é diagnóstico. A prancha de layouts orienta 2–6 participantes; não é
uma página adicional da aplicação. Não há alvo 1:1 de login/lobby/decks ou
preparação nesses documentos.

## Como demonstrar conclusão sem perder o alvo visual

Cada tarefa contém seus critérios específicos e a exigência de evidências.
As tarefas de base demonstram seu resultado parcial sem declarar aceita uma
tela ainda incompleta; as visuais corrigem diferenças dentro do próprio escopo,
sem transferi-las como “polimento futuro” para #81.

- Produzir HTML V2 × aplicação real lado a lado, mesma escala e viewport,
  com fontes/assets carregados e estado identificado. Medir e comparar regiões,
  controles, espaçamentos, fontes, cores, fundos, molduras e hierarquia.
- Distinguir exceções aprovadas, conteúdo dinâmico e defeitos de apresentação.
  Não há percentual arbitrário de diferença de pixels aprovado para dispensar
  revisão. Não usar baseline da própria aplicação como substituto do HTML.
- Exercitar navegador com API real e banco descartável, sem depender da sala 4
  ou de credenciais pessoais. Não basta DOM/classe CSS, mock de partida ou
  interseção parcial; observar o gesto e resultado público pertinente.
- Manter evidências de geral/foco para 2–6 no desktop e ambas as orientações,
  adaptação entre tamanhos, campos ocupados/densos e operações preservadas.
  Ao menos uma rodada final usa imagens reais completas de cartas.
- Conferir persistência, privacidade e permissões pela fronteira pública,
  usando outro cliente quando necessário. Observação não deve executar ações
  de jogo ou regravar posições.
- Na #81, reunir os nove estados, resultados e diferenças. **A revisão visual
  explícita do usuário é requisito de aceite final.** Enquanto pendente,
  registrar “aguardando revisão visual”; não fechar #81/#70 nem fazer merge
  automático. Conclusão técnica de subissue não aprova visualmente o conjunto.

## Limites desta publicação

Somente tarefas, vínculos, dependências e rastreabilidade documental foram
criados. Não há nova implementação ou resultado de teste da aplicação.
As capturas anteriores continuam diagnóstico histórico. Regras de banco,
arquitetura, contratos e fluxo de branches/PRs permanecem nas instruções
existentes; este plano não autoriza mudanças nessas áreas.
