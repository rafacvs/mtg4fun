# Interface e operações manuais do grimório

> O acesso e a apresentação dos menus foram refinados posteriormente na
> [decisão 28](28-ui-mesa-responsiva.md). As validações abaixo são históricas.

Issues relacionadas: [10](../issues/10-consultar-e-embaralhar-grimorio.md) e
[11](../issues/11-alterar-estados-e-revelar-cartas.md), somente no escopo de
revelação do grimório. Referência: [mesa manual](../specs/02-mesa-e-interface.md).

## Proposta e aprovação explícita

Ao testar a interface, o usuário apontou a ausência de embaralhamento isolado
e a confusão do formulário de consulta/revelação. Foi proposto um menu por
intenção (comprar, embaralhar, olhar, buscar e revelar), seguido de uma área
de cartas com seleção explícita, reordenação por arraste ou setas, finalização
contextual e indicação de privacidade. A proposta também incluía revelar
cartas selecionadas durante uma consulta e expô-las na mesa dos participantes.

O usuário aprovou os quatro pontos da proposta na conversa e pediu a
implementação em branch/worktree separadas, conventional commits e PR aberto
para revisão. Reforçou que as operações são básicas e manuais, sem implementar
mecânicas ou interpretar texto de cartas, e que a devolução deve permitir topo
ou fundo respeitando a ordem definida pelo jogador. Exigiu copiar os dados de
desenvolvimento sem alterar o banco original.

No refinamento seguinte, o usuário rejeitou as setas visíveis e pediu uma alça
de arraste à esquerda da imagem, seleção ao clicar na linha (sem ícone de +)
e ampliação ao clicar na imagem (sem botão separado). Essa solicitação substitui
esses detalhes da proposta inicial, mantendo as operações e contratos aprovados.

Depois, o usuário pediu que Olhar e Revelar usem a mesma lista vertical de
Buscar, rejeitando a apresentação em faixa com rolagem horizontal. As três
operações compartilham a apresentação e a reordenação por arraste vertical.

Essa autorização é limitada à interface/operações do grimório descritas aqui.
Não contempla as demais ações da issue 11, novas dependências, infraestrutura,
motor de regras ou mudanças no mecanismo de autenticação/transporte.

## Implementação

- Menu acessível pelo grimório na mesa e pelo botão existente. Embaralhar
  também fica disponível em Ações, sem exigir consulta prévia. Com uma consulta
  pendente, Ações oferece retomá-la para finalizar seu destino explicitamente.
- Olhar topo/fundo configura quantidade; buscar abre o grimório inteiro com
  filtro por nome e seleção restrita aos resultados. Clicar na linha seleciona;
  clicar na imagem abre a consulta individual. Seleções são movidas na ordem exibida.
- A alça à esquerda da imagem reordena por arraste com mouse ou toque; teclas
  de direção na alça mantêm uma alternativa acessível. A primeira carta exibida
  é a primeira do bloco devolvido, tanto no topo quanto no fundo. Botões
  distintos devolvem com ou sem embaralhamento, sem opção implícita no fechamento.
- O × e Escape recolhem o painel. Cartas e contexto continuam persistidos;
  o botão indica consulta em andamento, inclusive quando todas as cartas foram
  movidas e resta finalizar. Recarregar não devolve nem embaralha cartas.
- Revelar do topo usa a ação existente. Revelar seleção é uma variante
  adicional de `kind: "reveal"`, com `cardIds` e sem `count`, restrita à própria
  consulta. Não remove as cartas da sequência consultada. As cartas reveladas
  aparecem na mesa de todos; cartas privadas e contexto da consulta continuam
  filtrados pelo servidor.
- Na entrega original, a exposição terminava ao mover/devolver essas cartas ou finalizar a
  consulta. Fechar o painel mantém a exposição e permite retomada. O log
  conserva os nomes explicitamente revelados como informação já publicada.
  A duração foi posteriormente substituída pela aprovação explícita da
  [issue 11](11-estados-e-revelacoes.md): permanece até ocultar explicitamente.
  A ferramenta não determina por quanto tempo um efeito de Magic exige
  exposição: os jogadores resolvem isso manualmente.
- O snapshot recebe campos opcionais `revealed` nas cartas e
  `consultationFrom` no jogador. A visão pública só inclui cartas explicitamente
  reveladas; somente o dono recebe o contexto e a sequência privada.
  Não há migration de tabelas. Snapshots antigos sem os campos continuam
  legíveis; cartas da área antiga de revelação podem ser reordenadas e devolvidas.
  Quando a origem de uma consulta antiga não foi registrada, a interface
  oferece uma consulta com busca sem afirmar que as cartas vieram do topo/fundo.
- Os corpos existentes de revelar por quantidade, reordenar, fechar e
  embaralhar continuam aceitos. Fechar/embaralhar devolvem também as cartas
  temporárias reveladas sem perda ou duplicação. Na entrega original isso
  encerrava a exposição; a duração aprovada na issue 11 a preserva até ocultar
  explicitamente.

## Isolamento dos dados

`scripts/worktree.sh create grimorio-ux master` criou a branch
`work/grimorio-ux`, o projeto Compose `mtg4fun-grimorio-ux`, a porta 8089 e o
banco `mtg4fun_grimorio_ux` no MySQL local existente. A importação foi realizada
somente no novo banco. Antes de iniciar serviços da worktree, uma consulta
`CHECKSUM TABLE ... EXTENDED` confirmou checksums iguais nas doze tabelas
do banco principal e da cópia. Essa verificação foi somente leitura.
Após iniciar os serviços isolados, os checksums das doze tabelas continuaram
iguais, incluindo contas, sessões, decks e partidas.

As suítes automatizadas usam seus próprios bancos/containers descartáveis,
sem executar cenários no banco principal ou na cópia de desenvolvimento.
Resultados efetivamente executados são descritos no PR; não constituem
aprovação de escolhas além do escopo autorizado na conversa.
