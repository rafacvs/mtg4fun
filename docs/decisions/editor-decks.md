# Editor de decks

## Autorização de escopo

Em 17/11/2026, o usuário autorizou o editor de decks apesar de ele constar
fora da primeira versão nas especificações históricas. A autorização inclui
biblioteca com acesso por busca/capas, criação vazia, edição de nome, lista,
quantidades e comandante, busca do catálogo XML local por nome/texto, filtros
clicáveis por tipo/cor/identidade/valor de mana, prévia de texto/imagem,
contagens/curva, salvamento explícito e suporte a pendências de importação
parcial. Não autoriza validação de formatos de Magic nem catálogo externo.

## Comportamento entregue

- `POST /api/decks/draft` cria um rascunho vazio e privado.
- `GET /api/decks/catalog` exige sessão, consulta o catálogo compartilhado
  carregado dos XML versionados, com paginação por `offset` e `limit`.
  O padrão e o máximo são 50 cartas por página; a resposta informa `total`,
  `offset`, `limit` e `hasMore`. A busca
  cobre nome/texto; filtros usam tipos, identidade de cor (incluindo
  incolor e multicolorida) e CMC exato ou `12+`.
- `PUT /api/decks/{id}` salva nome, comandante e lista numa transação. O servidor
  valida titularidade, nome, nomes distintos, quantidades positivas e
  comandante presente entre as cartas. Só cartas de catálogo podem ser
  comandante; nomes pendentes continuam editáveis/removíveis na lista.
- Upload `.cod` mantém nome e quantidade de cartas que não existam no catálogo,
  com `available:false` para orientar correção. Erros de XML, limite de upload e
  quantidade inválida continuam sendo erros.
- Um deck vazio ou com pendências não pode confirmar prontidão. Um deck pronto
  fica bloqueado para edição; depois de desmarcar pronto, pode ser alterado.
  O início continua carregando dados para um snapshot próprio, portanto edição
  futura da biblioteca não altera partidas já iniciadas.
- Alterações no deck escolhido durante preparação atualizam a revisão pública
  já usada pelas salas. A API continua autenticada e só expõe a biblioteca do
  titular.

Os limites do editor de payload são 512 KiB, 2.000 nomes e até 100.000 cópias
no total. Os mesmos limites de nomes/cópias se aplicam à importação para evitar
expansão descontrolada no início de uma partida. Eles não
criam regra de formato/quantidade de Magic.

## Refinamento visual e desempenho

Após testar a primeira versão, o usuário pediu acabamento compatível com a
mesa e a busca do grimório, controles compactos e paginação de cerca de
50 cartas. O editor coloca o deck em primeiro plano, oferece Trocar/Remover
para qualquer carta, preserva a quantidade na troca e identifica pendências
por nome e quantidade. Catálogo e deck têm áreas distintas e abas no celular;
os filtros adicionais ficam recolhidos.

A busca espera 250 ms durante digitação, cancela requisições obsoletas e
substitui a página renderizada, sem acumular páginas nem manter o XML no
navegador. Imagens usam carregamento tardio e verso quando indisponíveis.
A ordenação é preparada uma vez no servidor e reaproveita as strings do
catálogo, sem duplicar textos nem guardar resultados por consulta. Uma seleção
editorial de cartas usuais aparece antes dos demais resultados; não representa
validação de formato ou recomendação de composição do deck.

Na medição local com 36.613 definições, a primeira página transferiu 17.819
bytes de JSON e respondeu em 21 ms por IPv4 local. O índice de nomes ocupa
aproximadamente 586 KB, além dos dados já carregados pela aplicação. Esses
números são uma amostra local, não garantia para outros computadores. Não foi
adicionado outro cache: paginação, cancelamento e o cache de imagens existente
atendem esta etapa sem retenção adicional de resultados no navegador.

## Verificação

Os testes de integração acrescentam exercício HTTP de ownership, rascunho vazio,
CRUD transacional, busca/filtros do catálogo e importação parcial; também
verificam que um deck pendente não confirma prontidão. O fluxo de navegador usa
a API real e cobre criação, filtros, alteração de quantidade, comandante,
salvamento e aviso de alterações não salvas em desktop e celular.
