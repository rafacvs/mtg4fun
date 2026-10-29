# Diagnóstico: mulligan ausente e criação de sala travada

Data da investigação: 29/10/2026.

## Resumo

Durante a implementação do mulligan, dois problemas distintos apareceram no
ambiente local:

1. o botão **Mulligan** desaparecia mesmo no primeiro turno;
2. o formulário **Montar a mesa** podia permanecer indefinidamente em
   **Criando…**.

As falhas tinham causas diferentes. A primeira era uma regressão no código do
frontend. A segunda ocorreu quando uma requisição atravessou o reinício do
backend durante o desenvolvimento e o cliente não possuía limite de espera.

## 1. Botão Mulligan ausente

### Sintoma

A partida estava no primeiro turno, o jogador tinha sete cartas e o snapshot
persistido informava `mulliganOpen: true`, mas o botão não era renderizado.

### Causa

O número de mulligans usa `omitempty` no snapshot JSON. Para um jogador que
ainda não realizou mulligan, o servidor omite o campo em vez de enviar zero.
No navegador, portanto, `own.mulligans` chegava como `undefined`.

Ao adicionar o limite de sete mulligans, o frontend passou a avaliar:

```ts
own.mulligans < 7
```

Em JavaScript, `undefined < 7` resulta em `false`. Assim, o jogador sem nenhum
mulligan era interpretado como alguém sem permissão para fazer outro.

### Correção

O cliente agora normaliza explicitamente o valor ausente:

```ts
const mulliganCount = own.mulligans ?? 0;
```

Todas as decisões de apresentação e limite usam `mulliganCount`. A janela
inicial também só é considerada encerrada quando o servidor envia
`mulliganOpen: false` explicitamente.

## 2. Formulário preso em “Criando…”

### Sintoma

Depois de clicar em **Criar e sentar**, o botão permanecia desabilitado com o
texto **Criando…**, sem concluir nem mostrar erro.

### Causa

Durante a implementação, arquivos Go foram formatados e recompilados pelo Air.
Isso reiniciou a API enquanto uma criação de sala estava em andamento. O proxy
do Vite perdeu temporariamente a conexão com a API.

A função compartilhada de mutações HTTP usava `fetch` sem timeout. Se a
conexão fosse interrompida em uma condição na qual o navegador não encerrasse
imediatamente a promessa, `useRooms` mantinha `busy=true` e o formulário ficava
preso em **Criando…**.

### Correção

As mutações comuns de salas agora usam um limite de 15 segundos por meio de
`AbortSignal.timeout`. Uma operação interrompida deixa o estado ocupado e
mostra:

> A operação demorou demais. Tente novamente.

Os serviços `api` e `app` também foram reiniciados juntos depois da mudança,
evitando que o teste manual continuasse usando uma requisição ou conexão antiga.

## 3. Falha no processo de validação

O primeiro teste automatizado criava a sala diretamente por `page.request`,
isto é, exercitava a API mas não o formulário React. Por isso ele não poderia
detectar um botão preso em **Criando…**. Informar que a criação estava validada
com base nesse teste foi incorreto.

O cenário foi alterado para usar a mesma fronteira do usuário:

1. abrir o lobby;
2. clicar em **Criar sala**;
3. preencher **Montar a mesa**;
4. clicar em **Criar e sentar**;
5. aguardar e verificar a resposta HTTP 201;
6. confirmar a sala na listagem pública;
7. preparar e iniciar a partida;
8. verificar e executar o mulligan pela interface.

## 4. Evidências atuais

- O fluxo completo pelo formulário passou uma vez após a correção.
- O mesmo fluxo passou mais três vezes consecutivas com `--repeat-each=3`.
- O cenário inclui criação da sala, início da partida, presença do botão,
  dois mulligans padrão, escolha da carta destinada ao fundo, manutenção da
  mão e fechamento da janela no avanço do turno.
- O snapshot das salas investigadas foi consultado diretamente no MySQL e
  continha `mulliganOpen: true`, confirmando que a ausência do botão era do
  cliente e não da persistência.
- TypeScript, testes unitários do frontend e testes do módulo Go de salas
  passaram nas execuções registradas durante a investigação.

## 5. Validação antes da publicação

Antes da publicação, o módulo Go de salas passou dentro do contêiner de
desenvolvimento. TypeScript, build do frontend e `git diff --check` também
passaram. O cenário E2E isolado não foi repetido nesta etapa porque o host não
dispunha do executável Go exigido pelo fixture; as execuções completas descritas
acima permanecem como evidência histórica da investigação.
