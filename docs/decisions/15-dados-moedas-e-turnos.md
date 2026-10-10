# Dados, moedas e turnos

Issue: [15](../issues/15-dados-moedas-e-turnos.md).

## Aprovação explícita

Durante a implementação da issue 15, o contrato das ações compartilhadas e a
chave de idempotência precisavam ser definidos. Foram apresentadas rotas
separadas ou um endpoint de ações discriminadas, com a chave no corpo ou no
cabeçalho. O usuário aprovou explicitamente o contrato consolidado:
`POST /api/rooms/{id}/match/actions`, corpo discriminado e `intentId` UUID
obrigatório, persistido por partida e jogador. Também aprovou visão filtrada em
GET/respostas e polling HTTP a cada um segundo enquanto a mesa estiver aberta.

## Implementação

O corpo usa `kind: "roll"` com `sides` entre 2 e 100, `kind: "coin"`, ou
`kind: "turn"` com `direction: "next"` ou `"previous"`. Cada intenção é
gravada com a alteração do snapshot e o evento na mesma transação; reenviar a
mesma intenção do mesmo participante não gera uma nova aleatoriedade ou evento.

O snapshot registra o índice do turno na ordem circular sorteada no início. Os
participantes podem avançar ou corrigir o indicador, sem fases nem restrições
às outras ações. Resultados de dado/moeda e alterações de turno ficam no log
público filtrado, persistem após reinício e aparecem na interface PT-BR.

O armazenamento `match_intents` usa chave primária por partida, participante e
UUID. A tabela não contém conteúdo de cartas nem dados privados; a autorização
continua exigindo participação na partida.
