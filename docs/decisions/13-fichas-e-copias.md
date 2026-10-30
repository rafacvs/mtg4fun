# Fichas e cópias independentes

> Ajustes posteriores: [regras e interface da mesa](22-ajustes-da-mesa.md).

Issue: [13](../issues/13-criar-fichas-e-copias.md).

## Proposta e aprovação explícita

Após investigar o catálogo, os snapshots e o contrato existente de ações, foram
apresentadas ao usuário criação no campo próprio ou escolha de zona e cópia
somente das características ou de todos os estados. O usuário respondeu
**“13: ok”** à proposta consolidada nesta conversa, autorizando:

- Fichas e cópias entram no campo do criador, com ele como dono e controlador;
  usam os movimentos existentes e não são excluídas automaticamente ao sair.
- A cópia exige uma carta identificada na visão autorizada do participante.
  Copia nome, texto, imagem, poder/resistência, faces e face ativa. Estados de
  uso/ocultação/revelação, contadores, posição e identidade não são herdados;
  alterações posteriores no original não propagam para a cópia.
- Busca autenticada de fichas compartilhadas, com até 100 resultados ordenados.
- Personalização: nome entre 1 e 200 caracteres, descrição até 5000,
  poder/resistência opcionais como o modificador numérico da mesa, inclusive
  negativo; imagem padrão local, sem upload. A busca do catálogo ainda mostra
  o texto impresso da ficha. Na mesa, só entra o inteiro; um valor como `*`
  fica zero.
- Ações novas reutilizam HTTP, intenção UUID, transação, snapshot e log já
  existentes. Nenhuma nova dependência, infraestrutura ou fonte externa.

As fronteiras de teste são o executável/API HTTP com MySQL real e reinício e
os fluxos reais de navegador, já exigidos pelo [AGENTS](../../AGENTS.md) e pela
[estratégia de testes](../testing.md).

## Aprovação explícita da interface

Em 12 de outubro de 2026 o usuário aprovou a apresentação, depois de ver a
tela: a janela acompanha o conteúdo, com a moldura das ações, e começa pela
escolha entre ficha do catálogo e ficha personalizada. Voltar fica no
cabeçalho, à esquerda do título, e a miniatura do catálogo abre o mesmo
diálogo de imagem das cartas. A cópia independente permanece no diálogo da
carta. O contrato de criação não muda.

## Implementação e validação

`GET /api/rooms/{id}/match/tokens?q=` exige participação na partida e retorna
`tokens` com nome, texto, poder/resistência e `imageName`. A busca ignora caixa e
retorna até 100 nomes ordenados; refinar a busca localiza resultados restantes.
Imagens usam o cache existente, sem aceitar URL enviada pelo navegador.

`POST /api/rooms/{id}/match/actions` recebe `intentId` UUID e:

- `kind: create-token`, `tokenName`: nome exato da ficha compartilhada.
- `kind: create-custom-token`, `name`, `description`, `power`, `toughness`:
  campos opcionais além do nome; espaços nas pontas do nome são removidos.
- `kind: copy-card`, `cardId`: instância identificada na visão autorizada,
  incluindo mão/consulta próprias ou cartas públicas; grimório fechado e
  cartas privadas de oponentes são recusados sem divulgar atributos.

A criação usa identidade aleatória de 128 bits, posição inicial independente,
dono/controlador criador e zona campo. Snapshot, log público da criação e intenção
são persistidos juntos antes da confirmação. Reenvio devolve a visão atual sem
criar outra instância ou entrada de log. A representação congela características;
nomes das imagens continuam utilizando o catálogo/cache compartilhado existente.

As cópias herdam `faces` e `faceIndex` quando presentes no snapshot; a escolha de
faces/estados pertence à issue 11, e a alteração de contadores à issue 12. Esta
branch não oferece ações dessas issues. Nenhuma regra de Magic é automatizada.

## Validação executada

- `go -C api test ./... -count=1`: passou a suíte completa, incluindo catálogo,
  criação/personalização, visibilidade, independência, limites, recuperação,
  reenvio e cache compartilhado com fonte HTTP controlada.
- `go -C api vet ./...`, `npm run typecheck --prefix app`,
  `npm run build --prefix app`, links novos e `git diff --check`: passaram.
- `npm test --prefix app -- fichas.spec.ts --workers=2`: 3 variantes passaram
  (desktop com mouse e celular com toque); API real, imagem padrão, texto,
  poder/resistência, criação, cópia e recuperação após recarga.
- Suíte completa Playwright: 44 passaram, 19 foram omitidos pelos critérios
  existentes (Docker/local UI e orientação), 3 falharam no cenário antigo
  de seis mesas, linha 182: proporção das zonas abaixo de 1,2, com resultados
  desktop 1,078342, celular 0,773872 e horizontal 0,492188. O agente da issue 12
  executou a base `6a3c26e` arquivada com API/cliente originais e MySQL isolado,
  reproduzindo a falha desktop com o mesmo valor 1,0783420138888888.
  Esta branch não altera a geometria das zonas; as falhas foram registradas,
  sem atribuir aprovação da suíte completa ou corrigir layout fora do escopo.

A consulta de fichas reutiliza o provedor/cache existentes sem alterar fonte,
URL, cabeçalhos ou política de download; não foi introduzida uma nova integração
externa. Não foram executados testes operacionais Docker nesta issue.

## Posicionamento de fichas equivalentes

Em 29/10/2026, o usuário pediu que a primeira ficha priorize uma célula sem
cartas e que as seguintes sejam empilhadas no campo de batalha. A criação passa
a iniciar uma pilha na primeira célula totalmente vazia da fileira superior,
sem sobrepor uma carta preexistente. Novas fichas equivalentes (mesmo nome e
tipo de instância) entram nessa pilha até o limite existente de três; a próxima
inicia outra célula vazia. Movimentos, transferências e cópias preservam suas
regras anteriores.

A revisão independente pelos dois eixos da skill `code-review` está pendente.
