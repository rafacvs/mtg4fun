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

O estado atual substitui a importação por CLI descrita acima; ver
[catálogo versionado em memória](#catálogo-versionado-em-memória). O servidor
carrega na inicialização os arquivos versionados em `api/catalog/` (ou caminhos
de `--cards`/`--tokens`, `CATALOG_CARDS`/`CATALOG_TOKENS`). Os arquivos de cartas
são produzidos pelo Oracle do Cockatrice, cujo dataset é MTGJSON AllPrintings.
Fichas seguem o XML oficial do projeto Magic-Token. Catálogo ausente ou inválido
impede o início. Nenhuma operação HTTP de usuário permite alterar o catálogo.

O catálogo em memória guarda nome, texto e marcador de ficha. Como no parser
Cockatrice, nomes repetidos mantêm a primeira definição. Edições, propriedades e
demais metadados permanecem nos XML e podem ser carregados quando houver uso, como
na [issue 04](../issues/04-consultar-cartas-e-imagens.md), dona do cache de imagens.

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

## Catálogo versionado em memória

Na revisão do PR, o usuário enviou `deck_hydra.cod`, usado no Cockatrice, e o
upload falhou em `Tranquil Thicket`. A investigação mostrou que todos os nomes do
deck existem no MTGJSON. A carta é apenas a primeira do arquivo: o servidor não
tinha catálogo real, porque o Oracle não estava disponível para gerar `cards.xml`.
No Cockatrice o Oracle baixa esse catálogo completo na primeira execução.

Foram apresentadas alternativas de download/conversão pelo servidor, Oracle em
Docker ou importação manual. O usuário respondeu: **“pode ser o servidor baixa
MTGJSON e tokens.xml, mas nao precisa de código/logica para isso. Baixe e deixe
local no proprio repositorio”** e **“nao vai ter download: baixe agora para termos
os catalogos e tokens locais, e depois eu matenho manualmente”**. Assim, o Oracle
do Cockatrice 3.1.1 foi compilado e executado fora do repositório, e seus arquivos
foram versionados em `api/catalog/`: MTGJSON `5.3.0+20261008` (35.580 cartas) e
Magic-Token (1.035 fichas). Não há código de download; a atualização é manual.

Importar o catálogo real no MySQL revelou uma segunda falha: a transação única
excedia a capacidade padrão do redo log (100 MiB), e a pausa do InnoDB ultrapassava
o timeout de leitura de 10 s da conexão, desfazendo a importação. Uma correção
intermediária gravou em lotes e levou cerca de 5 minutos no disco btrfs desta
máquina. A etapa manual de importação foi a causa original da falha, então o
usuário aprovou explicitamente, após comparar tabela e memória: **“faça essa
correção para ler direto da memoria”**. A tabela `catalog_cards` e o comando
`import-catalog` foram removidos; atualizar o catálogo é substituir os arquivos e
reiniciar a API. A imagem de produção inclui os arquivos.

Verificação: o carregamento dos 36.613 registros leva cerca de 1 s e ocupa cerca
de 9 MiB de heap Go. No ambiente Docker dev da worktree, a API reiniciou sem passo
de importação e o upload de `deck_hydra.cod` retornou 74 entradas/100 cartas,
todas disponíveis. `go -C api vet ./...`, `go -C api test ./... -count=1`,
`npm run typecheck --prefix app`, `npm run build --prefix app` e
`npm test --prefix app -- --workers=3` (15 cenários; hot reload omitido fora do
Docker dev) passaram. O teste de integração novo carrega `api/catalog/` e envia
cada deck de `api/tests/integration/testdata/decks/`; outro confirma que o servidor
recusa iniciar com catálogo inválido.

## Validação da entrega original

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
