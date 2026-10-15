# Paleta do site e esferas de mana no login

## Solicitação e escopo

Em 15/10/2026, o usuário pediu uma nova branch para mudar o design,
**“sem mexes nas funcionalidades”**, usando a coloração do arquivo local
`mtg4fun.html` como referência. Depois pediu a animação JavaScript do login
e confirmou que a referência era esse mesmo arquivo.

A branch `work/design-paleta` parte da versão em revisão na
`work/finalizar-partida`, preservando os comportamentos existentes enquanto o
PR 26 aguarda revisão. Esta entrega aplica os valores de paleta e a composição
de esferas da referência no frontend React existente. Antes de abrir o PR,
o usuário pediu remover o `mtg4fun.html`; o arquivo local, que não estava
versionado, foi excluído conforme essa instrução.

## Apresentação

A paleta fica centralizada nas variáveis CSS de `app/src/styles/global.css`:

| Papel | Cor da referência |
| --- | --- |
| Fundo | `#0d0d10` |
| Painel | `#17171c` |
| Painel elevado | `#202027` |
| Divisórias | `#34343e` |
| Texto | `#f3ecda` |
| Texto secundário | `#a6a6b2` |
| Dourado | `#e0b552` |
| Dourado escuro | `#a8822c` |

Login, lobby, biblioteca de decks, preparação, mesa, consultas e diálogos
usam essas cores, com controles dourados e foco visível. Fundos recebem os
gradientes sutis da referência. As cores funcionais dos cinco marcadores e
do botão vermelho **Finalizar** são mantidas. Fora da composição do login,
o ajuste é restrito a cores, bordas e sombras, sem reorganizar as telas.

## Animação do login

O pedido da animação autoriza a integração visual do Three.js. O frontend usa
`three` 0.186.1 e os tipos 0.186.0, com versões fixadas no lockfile. A cena é
carregada por importação dinâmica apenas quando o login está montado, sem
usar os scripts de CDN, fontes externas ou dados fictícios do HTML.

As cinco esferas branca, azul, preta, vermelha e verde orbitam suavemente.
Desktop apresenta ilustração e formulário lado a lado; telas estreitas os
empilham. O formulário mantém os mesmos campos, validações, handlers e fluxo
de sessão. A ilustração é decorativa, sem foco ou interação.

`prefers-reduced-motion` mantém uma renderização estática, inclusive se a
preferência mudar durante a visita. O desenho adapta a câmera/tamanho à área
disponível, limita a densidade de pixels e suspende o loop com a página oculta.
Ao sair do login, descarta geometria, materiais, renderer e listeners. Sem
WebGL ou quando a cena não puder carregar, uma composição estática em CSS
preserva a ilustração e o acesso ao formulário.

## Verificações em 15/10/2026

- Build/TypeScript passaram. O build separa a cena Three.js em chunk próprio,
  de aproximadamente 529 kB antes da compressão (132 kB gzip); Vite informa
  o aviso de tamanho acima de 500 kB. A aplicação principal não incorpora
  esse código ao seu chunk inicial.
- Após aplicar somente a paleta, a regressão completa de navegador passou:
  62 cenários aprovados e 28 omitidos pelos critérios existentes de orientação,
  mouse e opt-in. Fluxos de jogo, prévias e encerramento mantiveram resultado.
- Após integrar a cena e a composição do login, os 27 cenários de acesso,
  decks e login visual passaram em desktop/celular vertical/horizontal.
  Comparações de capturas do canvas verificam que os pixels mudam na animação
  e ficam estáticos com movimento reduzido. Também cobrem troca de preferência,
  ausência de WebGL e entrada/saída/reabertura sem erro de JavaScript.
- Capturas de login desktop/celular e biblioteca de decks foram revisadas.
  O contraste calculado das combinações principais é 15,16:1 (texto/painel),
  6,72:1 (texto secundário/painel elevado), 9,27:1 (dourado/painel) e 5,13:1
  (texto do botão contra o extremo mais escuro de seu gradiente).
- `git diff --check`: passou. O frontend Docker foi reiniciado para instalar
  a dependência do lockfile; login e módulo da cena retornaram HTTP 200.

Não há alteração de backend, autenticação, contratos de rede, regras de jogo
ou persistência. A suíte Go e o smoke Docker de produção não foram repetidos
nesta entrega visual. Os testes de navegador usaram bancos descartáveis.
