# Capturas de paridade visual V2

Este procedimento prepara a evidência técnica da issue #72. Ele não declara
paridade nem substitui a revisão visual explícita do usuário exigida pela
issue #70.

Execute na raiz de `app/`:

```sh
npm run capture:parity-v2
```

O Playwright cria um MySQL descartável, inicia a API compilada e monta uma
partida por sua API pública com quatro participantes, mão, campos ocupados e
registro. As credenciais e a sala não vêm de uma conta pessoal ou do banco
principal. O resultado fica no diretório ignorado `app/test-results/`, em um
subdiretório por teste, contendo `comparativo-v2.html` e
`comparativo-v2.json`.

As referências vêm diretamente do HTML V2 no commit imutável
`170a87f10caa5f11708429ad0890df9c1cdde5bb`, caminho
`docs/redesign/mock-iterativo-v2.html`. A ferramenta falha se não puder
renderizar conteúdo de cada iframe, aguardar suas fontes ou gravar a captura;
ela nunca cria uma referência a partir da aplicação.

| Estado | Prancha | Viewport CSS | Cenário da aplicação capturado |
| --- | --- | --- | --- |
| V1 | Mesa em quadrantes · 4 jogadores | 1440×900 | Mesa de quatro recém-preparada. |
| V2 | Foco · ampliar um oponente | 1440×900 | Foco de Segundo amigo. |
| V3 | Leitura · prévia ao passar o mouse | 1440×900 | Hover na ficha do campo próprio. |
| V4 | Crônica aberta · grade se ajusta | 1440×900 | Registro aberto. |
| V5 | Celular horizontal · quatro campos | 844×390 | Mesa de quatro no horizontal. |
| V6 | Celular horizontal · foco em um oponente | 844×390 | Foco por toque em Segundo amigo. |
| V7 | Celular vertical · faixas e carta selecionada | 390×844 | Carta da mão própria selecionada. |
| V8 | Celular vertical · faixa expandida | 390×844 | Faixa de Segundo amigo ampliada por toque. |
| V9 | Celular vertical · ler carta de oponente | 390×844 | Painel inferior aberto ao tocar ficha adversária. |

O relatório identifica a referência e a captura da execução lado a lado; ele
nunca declara equivalência nem aceite. O mesmo fluxo registra geral e foco de
2–6 participantes nos três viewports, além da adaptação desktop em 1366×768.
O revisor precisa relacionar cada diferença somente às exceções aprovadas ou
tratá-la como defeito. A imagem completa de uma carta deve carregar pelo
endpoint público: se a fonte externa estiver indisponível, o teste falha e
nenhuma captura parcial conta como evidência final.
