# Aceite visual integrado — paridade V2

Issue: [#81](https://github.com/rafacvs/mtg4fun/issues/81), parte da
[spec #70](https://github.com/rafacvs/mtg4fun/issues/70).

## Estado da evidência

**Aguardando revisão visual explícita do usuário.** Este documento não
declara paridade nem aprovação. A referência é o HTML V2 no commit imutável
`170a87f10caa5f11708429ad0890df9c1cdde5bb`; as exceções aplicáveis continuam
sendo somente campo manual, cartas inteiras, dados reais e adaptação de 2–6
participantes.

| Pranchas | Viewport CSS | Cenário a comparar |
| --- | --- | --- |
| V1 — Mesa em quadrantes · 4 jogadores | 1440×900 | visão geral com quatro participantes |
| V2 — Foco · ampliar um oponente | 1440×900 | foco de oponente e retorno |
| V3 — Leitura · prévia ao passar o mouse | 1440×900 | hover passivo |
| V4 — Crônica aberta · grade se ajusta | 1440×900 | registro aberto |
| V5 — Celular horizontal · quatro campos | 844×390 | mesa horizontal |
| V6 — Celular horizontal · foco em um oponente | 844×390 | foco por toque |
| V7 — Celular vertical · faixas e carta selecionada | 390×844 | seleção própria |
| V8 — Celular vertical · faixa expandida | 390×844 | faixa em foco |
| V9 — Celular vertical · ler carta de oponente | 390×844 | painel inferior de leitura |

Também é necessária a captura da visão desktop em 1366×768 e as adaptações
de geral/foco para 2–6 participantes nas três orientações. Para cada par,
o revisor deve registrar composição, medidas, fontes, cores, playmat,
molduras, controles e toda diferença; diferenças fora das exceções acima são
defeitos, não calibração futura.

## Procedimento reproduzível

O procedimento reproduzível é `npm --prefix app run capture:parity-v2`. Ele
usa Playwright, a API pública e MySQL descartável, e grava os pares lado a
lado em `app/test-results/`; a referência nunca é derivada da aplicação.
Depois da execução, abrir o arquivo
`app/test-results/**/comparativo-v2.html` para revisar os nove pares. Os
diretórios de resultado são ignorados pelo Git:
o revisor os gera localmente pelo mesmo comando, sem depender de credenciais,
sala ou banco principal.

## Execução técnica registrada

Em 26/10/2026, na branch de integração, `npm --prefix app run
capture:parity-v2` passou: três testes Playwright em 43,5 segundos, com
navegador, API Go e MySQL descartável reais. A execução produziu:

- nove referências HTML V2 e nove capturas da aplicação, mais a captura
  desktop de 1366×768;
- `comparativo-v2.html` e `comparativo-v2.json` lado a lado para V1–V9;
- 35 capturas da matriz de geral/foco de 2–6 participantes: desktop,
  horizontal e vertical, mais 1366×768 para cada quantidade de jogadores.

A carta `Island` foi carregada pelo endpoint público como `image/jpeg`; não
houve placeholder. Esse resultado prova que o procedimento e as fronteiras
funcionais executaram. Ele não é uma declaração de paridade: a avaliação dos
atributos visuais abaixo permanece pendente do revisor humano.

## Registro por prancha

O `comparativo-v2.json` e o HTML lado a lado trazem, para cada prancha, estes
mesmos nove campos. Eles começam como **aguardando revisão visual humana**:
uma captura automatizada prova que o estado público foi alcançado, mas não
declara que sua aparência é igual à referência. Ao revisar, registre a
diferença observada ou uma das quatro exceções aprovadas; qualquer outra
diferença é defeito.

| ID | Evidência técnica gerada | Composição e medidas | Tipografia e cores | Playmat e molduras | Controles | Diferenças e exceções |
| --- | --- | --- | --- | --- | --- | --- |
| V1 | `v1-referencia-v2.png` × `v1-aplicacao-atual.png`; visão geral real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V2 | `v2-referencia-v2.png` × `v2-aplicacao-atual.png`; foco real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V3 | `v3-referencia-v2.png` × `v3-aplicacao-atual.png`; hover passivo real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V4 | `v4-referencia-v2.png` × `v4-aplicacao-atual.png`; crônica aberta real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V5 | `v5-referencia-v2.png` × `v5-aplicacao-atual.png`; horizontal real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V6 | `v6-referencia-v2.png` × `v6-aplicacao-atual.png`; foco horizontal real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V7 | `v7-referencia-v2.png` × `v7-aplicacao-atual.png`; seleção vertical real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V8 | `v8-referencia-v2.png` × `v8-aplicacao-atual.png`; foco vertical real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |
| V9 | `v9-referencia-v2.png` × `v9-aplicacao-atual.png`; leitura móvel real | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana | Aguardando revisão visual humana |

## Próximo gate

Solicitar a revisão visual explícita do usuário sobre os comparativos gerados.
Até essa manifestação, #81 e #70 permanecem abertas; esta documentação não
declara aprovação nem autoriza merge automático.
