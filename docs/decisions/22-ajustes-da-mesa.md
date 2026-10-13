# Ajustes de regras e interface da mesa

## Autorização e escopo

Em 13/10/2026, o usuário solicitou os ajustes de revelação, movimentos,
marcadores, ações rápidas, layout e apresentação das telas descritos nesta
entrega. Essa instrução autoriza as mudanças de comportamento abaixo e substitui,
nesse escopo, os comportamentos históricos das decisões
[11](11-estados-e-revelacoes.md), [12](12-vida-e-contadores.md) e
[13](13-fichas-e-copias.md). As aprovações e validações antigas continuam sendo
registros históricos; não são evidência de validação destes ajustes.

O usuário também determinou usar uma branch de testes e não fazer commits na
master. A branch desta tarefa é `work/testes-mesa`. Mais tarde pediu **“não commite
nada ainda”**, suspendendo commits e publicação. Após revisar os ajustes,
pediu **“faça o commit nessa branch de teste”**, autorizando os commits locais
na `work/testes-mesa`. A master continua sem alterações. Pediu também para
não enviar o resumo HTML: ele permanece como arquivo local ignorado pelo Git;
o resumo Markdown continua versionado.
Após uma consulta específica,
respondeu **“não mexa nessa parte, deixe como está hoje”** sobre edição de decks e
cadastro de comandante. A biblioteca conserva seus contratos e operações.

## Regras implementadas

- Abrir uma imagem é uma visualização local, sem alterar o snapshot público.
  Revelar exige uma ação explícita. Fechar o detalhe oculta a revelação da carta
  controlada pelo jogador, salvo quando ele marca **Manter revelada ao fechar**.
  Passar para o próximo turno limpa todas as revelações de todos os jogadores;
  corrigir para o turno anterior não desfaz nem cria revelações.
- **Ocultar todas reveladas** afeta somente as cartas do próprio jogador. Tanto
  essa ação quanto passar turno preservam zonas e ordem. Consultas abertas
  permanecem privadas e podem ser retomadas/devolvidas normalmente.
- Revelar o topo inicia uma consulta com cartas marcadas como públicas; não
  cria uma segunda consulta simultânea. Snapshots antigos com a zona temporária
  `revealed` continuam legíveis: ocultação não move essas cartas, o dono mantém
  acesso e pode devolvê-las. A exposição é sempre filtrada pelo booleano.
- Toda mudança de zona usa `placeCards` em `zone_transitions.go`. Fichas e cópias desaparecem quando o
  destino é fora do campo. `isToken` identifica novas instâncias; `instanceKind`
  reconhece instâncias antigas sem migração destrutiva dos snapshots.
- Cartas normais que saem do campo para cemitério/exílio perdem os cinco
  marcadores, modificadores numéricos de poder/resistência, virado e face para
  baixo. Identidade, face escolhida e revelação seguem suas regras próprias.
- Vida/marcadores e P/T conservam o contrato de definir/incrementar, números
  inteiros seguros e valores negativos. Log e snapshot usam a transação e a
  idempotência existentes. Nenhuma fonte externa ou dependência nova.

## Escolhas locais de apresentação

Agrupamento manual aproveita `row`, `positionX` e `stackOrder`, com no máximo
três cartas por pilha. Após revisar a tela em 13/10/2026, o usuário pediu
remover as linhas visuais do Campo sem interferir nas cartas juntas. Foi
removido apenas o fundo que desenhava essas linhas; coordenadas, espaçamento,
pilhas e encaixe nas fileiras permanecem iguais. A apresentação reserva a largura
rotacionada e o deslocamento da pilha para não colidir com a vizinha, sem alterar
as posições persistidas. Não há classificação automática por tipo ou vínculo
entre cartas da pilha. O campo mantém scroll e zoom.

Atalhos: **D** compra uma carta, **U** desvira todas, **N** passa turno,
**H** oculta as próprias reveladas. Teclas com modificadores, repetição, foco em
campos editáveis ou diálogos abertos não disparam ações. Clique no grimório abre
as ações; duplo clique cancela essa abertura e compra uma carta. Uma proteção de
450 ms impede repetir a compra numa sequência acidental de duplos cliques.

Ainda nessa revisão, o usuário pediu os botões **Grimório** e **Ações** na
mesma fileira de comprar/passar turno/desvirar. Eles ficam na barra única
acima da mão, sem botões flutuantes; em espaço estreito, a barra permite scroll
horizontal em vez de mudar a fileira.

A coluna de jogadores/registro tem 240–260 px, recolhe por botão e começa recolhida
em telas de até 1000 px. O detalhe da carta usa imagem e controles lado a lado,
com fallback de scroll em viewports muito baixos. A mesa permanece horizontal
no celular; login, salas e decks funcionam na vertical.

Na revisão seguinte, os números dos marcadores foram centralizados dentro dos
círculos. Os nomes e as contagens de Comandante, Grimório, Cemitério e Exílio
foram organizados em linhas centralizadas para caberem na coluna; zonas vazias
mostram **Vazio**, sem duplicar o nome da zona. São ajustes de apresentação,
sem alteração das posições persistidas ou das regras de jogo.

## Validação

Em 13/10/2026:

- Suíte completa Go com MySQL real e executável HTTP: passou, incluindo
  permissões, privacidade, movimentos, remoção de fichas/cópias, limpeza de
  estados, revelações dos dois participantes, snapshot e log após reinício.
- `go -C api vet ./...`, build e tipos do frontend, três testes unitários dos
  gestos e `git diff --check`: passaram. Links locais novos: conferidos.
- Última execução ampla Playwright: 54 passaram, 23 foram omitidos pelos
  critérios de orientação/opt-in existentes e um teste de toque falhou por
  iniciar o próximo gesto antes da confirmação da posição. Esse teste foi
  corrigido para esperar o estado público e a posição renderizada; a execução
  posterior passou seis vezes (duas em cada variante de mouse/toque).
- Após acrescentar a recuperação de confirmação perdida dentro do detalhe,
  o conjunto de ajustes/estados/fichas passou nove cenários, com três omissões
  por orientação vertical. A perda de confirmação ocorre após a chamada real
  ao servidor; o botão de retry recupera a visão com a mesma intenção.
- Os demais fluxos exercitaram login, importação/consulta/exclusão de decks,
  salas, seis jogadores, consulta/reordenação do grimório, marcadores negativos,
  ciclo de revelação, atalho/botão de ocultação, turno, desvirar todas, compra
  por duplo clique, geometria do Comandante, pilhas mistas e scroll.
- Depois das revisões de linhas, botões e contadores das zonas, build e tipos
  passaram. A última execução de `ajustes-mesa.spec.ts` passou quatro cenários
  em desktop/celular horizontal, com duas omissões por orientação vertical.
- Docker local: frontend retornou 200 e API retornou 401 para consulta sem
  sessão (proteção esperada); MySQL saudável e Air recompilando as alterações.
  Não foi executada a suíte operacional Docker de produção.

Os cenários de `app/tests/e2e/ajustes-mesa.spec.ts` criam os dados pela API real
em MySQL descartável e geram imagens para revisão em `app/test-results/`.
O comando está documentado no README. As contas/mesas do ambiente local não
receberam seeds de testes. Imagens podem ser controladas para tornar a
geometria reproduzível, sem substituir ações ou respostas da API.
