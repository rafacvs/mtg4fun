# Vida e marcadores

> A navegação passa ao menu do jogador e ao detalhe agrupado de carta conforme
> a [decisão 28](28-ui-mesa-responsiva.md), preservando a semântica dos valores.

> Ajustes posteriores: [regras e interface da mesa](22-ajustes-da-mesa.md).

Issue: [12](../issues/12-modificar-vida-e-contadores.md).

## Aprovação revogada

Em 12 de outubro de 2026 o usuário tinha aprovado nomes livres de contador,
com a lista `counterNames` restrita ao jogador que criou o nome e à partida
em curso. Essa aprovação foi revogada nesta conversa. O nome livre e a lista
`counterNames` saem.

## Escolha explícita

Na mesma conversa o usuário escolheu o modelo abaixo. A mesa não pede um nome
de contador. Vida, cor e poder/resistência são intenções separadas. O sistema
não interpreta o que a cor significa, nem derrota, custo ou regra de Magic.

- **Vida** abre uma tela só, a partir do item Vida na grade de ações. Número
  grande, − e +, e uma quantidade com Definir, Adicionar e Subtrair. Subtrair
  usa número positivo. Não há marcador ao lado.
- **Marcadores** do jogador abre uma tela só. Cada cor — vermelho, amarelo,
  verde, azul e roxo — é o primeiro elemento da linha, seguido de −, da
  quantidade e de +. Não há Definir nem outra tela por cor.
- Na carta, o diálogo aberto pelo clique mostra os dois campos na mesma
  linha da imagem, separados por /, sem rótulo repetido e sem botão de
  confirmar. Aceitam inteiros negativos, como `-1/+4`, e gravam ao digitar.
  **Marcador** fica nessa mesma linha e abre a tela das cores. O modificador
  aparece na carta da mesa quando não é zero. Não existe o nome “+1/+1”.

O menu Ações volta a ser só a grade de intenções. Cada intenção que pede
valor abre uma tela. Voltar fica no cabeçalho, à esquerda do título, na mesma
linha do fechar. Comprar e dado seguem esse caminho. Moeda, turno e embaralhar
continuam ações imediatas da grade, porque não têm quantidade. Fichas não
entram nesta entrega.

O foco do botão fechar só é aplicado quando a tela abre. Atualização da
partida e uma nova identidade de `onClose` não recentram o foco.

## Contrato e semântica

`POST /api/rooms/{id}/match/actions` recebe `intentId` UUID e `kind: "counter"`,
`target: "player"` com `playerId` ou `target: "card"` com `cardId`,
`subject: "life" | "power" | "toughness" | "marker"`, `operation: "set" | "increment"`
e `value` inteiro. `color` só entra quando `subject` é `marker`
(`red` | `yellow` | `green` | `blue` | `purple`). Vida, poder e resistência
ignoram `color`. Marcador exige `color`. Vida só em jogador. Poder e
resistência só em carta. O campo `name` não é mais aceito.

A vida do jogador altera o campo `life`, inicializado pela configuração
existente no banco. Valores e resultados ficam no intervalo de inteiros
seguros do JavaScript. Zero e negativos são aceitos.

As ações usam o bloqueio transacional da partida: `set` substitui o valor
vigente na ordem serializada; `increment` soma ao valor vigente (zero quando
ainda não há contagem), sem perder incrementos concorrentes. Reenvio do mesmo
UUID pelo mesmo jogador não reaplica o efeito. Snapshot, log e intenção são
gravados juntos antes da confirmação.

No campo, a permissão pertence ao controlador; nas demais zonas, ao dono.
Jogador altera somente a própria vida e os próprios marcadores. Grimório não
expõe instâncias: para alterar uma carta nele, o jogador consulta as cartas
primeiro. Marcador e modificador de carta na mão, e os de consulta ainda
privada, não são enviados ao oponente. Carta virada para baixo também oculta
esses valores de quem não é dono nem controlador. O registro de carta é
genérico, sem identificador, cor ou valor, para não vazar quando a visibilidade
muda. Marcadores de cor do jogador e a vida são públicos.

O snapshot JSON guarda `power` e `toughness` na carta e cinco contagens em
`markers` na carta e no jogador. Campos com `omitempty`: ausência em partidas
já gravadas neste branch continua legível e vale zero. Não há migration: o
snapshot já é JSON e esta branch ainda não está na master. `counters` e
`counterNames` deixam de ser lidos e gravados.
