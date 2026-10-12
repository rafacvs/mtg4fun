# Interface e operações manuais do grimório

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

Essa autorização é limitada à interface/operações do grimório descritas aqui.
Não contempla as demais ações da issue 11, novas dependências, infraestrutura,
motor de regras ou mudanças no mecanismo de autenticação/transporte.

## Implementação

- Menu acessível pelo grimório na mesa e pelo botão existente. Embaralhar
  também fica disponível em Ações, sem exigir consulta prévia. Com uma consulta
  pendente, Ações oferece retomá-la para finalizar seu destino explicitamente.
- Olhar topo/fundo configura quantidade; buscar abre o grimório inteiro com
  filtro por nome e seleção restrita aos resultados. Imagens selecionam cartas;
  Ampliar abre a consulta individual. Seleções são movidas na ordem exibida.
- Setas e arraste reordenam a sequência persistida. A primeira carta exibida
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
- A exposição atual termina ao mover/devolver essas cartas ou finalizar a
  consulta. Fechar o painel mantém a exposição e permite retomada. O log
  conserva os nomes explicitamente revelados como informação já publicada.
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
  temporárias reveladas, encerrando a exposição sem perda ou duplicação.

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
