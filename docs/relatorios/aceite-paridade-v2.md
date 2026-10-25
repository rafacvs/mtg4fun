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

## Procedimento e execução desta entrega

O procedimento reproduzível é `npm --prefix app run capture:parity-v2`. Ele
usa Playwright, a API pública e MySQL descartável, e grava os pares lado a
lado em `app/test-results/`; a referência nunca é derivada da aplicação.

Nesta entrega, em 25/10/2026, `npm --prefix app run build` passou. A captura
integrada foi iniciada, mas não alcançou o navegador: o ambiente não possui
Go nativo. Uma tentativa temporária de compilação no contêiner `golang:1.26`
produziu binário Linux, que o macOS recusou antes da API iniciar (`ENOEXEC`).
Portanto não há capturas novas nem resultado funcional a declarar. Isso não
é evidência de falha ou sucesso da interface; é uma limitação de ambiente.

Quando um Go nativo estiver disponível, executar o comando acima, anexar os
nove pares e a captura 1366×768 ao PR, comparar os estados de 2–6 e solicitar
a revisão visual explícita do usuário. Até essa manifestação, #81 e #70
permanecem abertas.
