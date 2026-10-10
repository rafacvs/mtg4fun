# Decks .cod e catálogo compartilhado

Issue: [02](../issues/02-importar-decks-cod.md).

## Proposta e aprovação explícita

Nesta tarefa foram apresentados ao usuário importação administrativa por CLI dos
XML Cockatrice `cards.xml` e `tokens.xml`, persistência compartilhada no MySQL,
contrato HTTP `GET/POST /api/decks` e `DELETE /api/decks/{id}`, upload multipart
no campo `file` de até 2 MiB, uso apenas de `main` e descarte das demais seções,
erros para XML/cartas/quantidades inválidos. A alternativa foi integrar o download
e conversão de MTGJSON automaticamente, com mais escopo e dependência de rede.
O usuário respondeu **“card 2 - aprovo cli xml”** à proposta. Esta autorização
se aplica à proposta de importação administrativa apresentada nesta conversa;
não autoriza editor, download automático, validação de formatos ou novos limites
de composição dos decks.

## Implementação

O administrador importa os dois datasets usando `import-catalog --cards ... --tokens ...`.
Os arquivos de cartas podem ser produzidos pelo Oracle do Cockatrice, cujo dataset
é MTGJSON AllPrintings. Fichas seguem o XML oficial do projeto Magic-Token. O
catálogo é substituído em uma transação MySQL e continua disponível após reinício.
Falha de leitura ou gravação preserva a versão anterior. Nenhuma operação HTTP de
usuário permite alterar o catálogo.

Nomes, textos, marcador de ficha e metadados XML (incluindo propriedades, edições,
identificadores, relações e múltiplas faces) são preservados. Como no parser
Cockatrice, nomes repetidos mantêm a primeira definição e agregam edições.
O servidor não baixa imagens nesta entrega; cache de imagens pertence à [issue 04](../issues/04-consultar-cartas-e-imagens.md).

O deck guarda nome, nomes das cartas e quantidades, vinculados ao titular.
`main` inclui suas categorias/subzonas; outras seções de nível superior, incluindo
`side`, são ignoradas mesmo que tenham cartas ausentes do catálogo. Repetições de
uma carta são somadas. Deck sem nome recebe o nome do arquivo. XML inválido,
principal vazio, quantidades não positivas/não inteiras ou fora da representação
inteira do Cockatrice e cartas desconhecidas produzem mensagens PT-BR.

A listagem resolve os metadados contra o catálogo atual. Atualizar textos/edições
não exige reupload. Se um novo dataset remover uma carta, seu nome e quantidade
continuam no deck, com `available: false`, sem exclusão silenciosa. Decks não
alteram o catálogo e usuários só listam/excluem a própria biblioteca. Preparação
de partidas reutilizando a biblioteca pertence à [issue 05](../issues/05-preparar-e-iniciar-partida.md); a interface atual
permite escolher e consultar decks salvos.

## Validação desta entrega

- `go -C api vet ./...` e `go -C api test ./... -count=1`: passaram com
  MySQL real isolado, incluindo importação, bibliotecas de contas distintas,
  exclusão, reinício, catálogo atualizado/removido e rollback de gravação parcial.
- `npm run typecheck --prefix app` e `npm run build --prefix app`: passaram.
- `npm test --prefix app -- --workers=3`: 15 cenários passaram em desktop,
  celular vertical e horizontal; os 3 cenários de hot reload foram omitidos
  porque são exclusivos do ambiente Docker dev. Fluxos de decks incluem
  escolha do arquivo, upload, listagem/seleção após recarga, exclusão e erros PT-BR.
  A regressão de listagem inicial atrasada foi reproduzida antes da correção:
  upload aguarda a conclusão da listagem para impedir perda visual do deck salvo.
- Fixtures incluem `.cod` com escapes, quantidades repetidas e seção `side`,
  categorias de `main`, cartas divididas, fichas, nomes duplicados no catálogo e
  trecho do dataset oficial Magic-Token (versão de origem 20260925).
- Links locais e `git diff --check`: conferidos.

Estas verificações cobrem a entrega intermediária de biblioteca/catalogação;
não declaram preparação, imagens ou jogo completo implementados. Não foram
executados testes operacionais Docker nesta issue, pois a infraestrutura não mudou.

## Revisão da implementação

A skill `code-review` revisou `96aeacd...68562dc` em duas worktrees independentes,
com leitura estática e sem nova execução de testes pelos revisores:

- Standards: apontou formatação pouco legível em transições de estado/calls HTTP
  TypeScript e uma possível duplicação da conversão de falhas de sessão em HTTP.
  A formatação foi expandida; `typecheck` e build passaram depois do ajuste,
  produzindo os mesmos artefatos de JavaScript/CSS. A extração de autenticação HTTP
  permanece uma sugestão opcional de manutenção, sem falha de segurança ou
  alteração do contrato. Preservou-se o módulo de autenticação compartilhado
  durante a implementação paralela de salas; o agente coordenador confirmou que
  esta heurística não exige refactor adicional nesta entrega.
- Spec: 0 achados; biblioteca, catálogo e testes correspondem à issue e à proposta
  aprovada. Preparação e imagens continuam no escopo das issues 05 e 04.

Os resultados dos testes acima pertencem ao implementador e não são atribuídos
à revisão estática. Uma revisão independente do PR pelo agente coordenador e a
revisão do usuário permanecem etapas separadas; nenhum merge está autorizado.
