# Vida e contadores

Issue: [12](../issues/12-modificar-vida-e-contadores.md).

## Proposta e aprovação explícita

Após investigar o endpoint de ações e o snapshot transacional existentes,
foram apresentados definir e incrementar inteiros, permissões do próprio
jogador, dono em zonas privadas e controlador no campo, com filtragem de
informações privadas. O usuário respondeu **“12: ok”** à proposta consolidada
durante esta implementação. Essa autorização não altera banco, transporte,
autenticação ou as regras de Magic.

## Contrato e semântica

`POST /api/rooms/{id}/match/actions` recebe `intentId` UUID e `kind: "counter"`,
`target: "player"` com `playerId` ou `target: "card"` com `cardId`, `name`,
`operation: "set" | "increment"` e `value` inteiro. `Vida` em jogador altera
o campo `life`, inicializado pela configuração existente no banco. Nas cartas,
`Vida` é um contador nomeado comum. Nomes preservam caixa e são aparados nas
extremidades; o limite local é 80 caracteres, sem controles. Valores e resultados
ficam no intervalo de inteiros seguros do JavaScript. Zero e negativos são
aceitos sem avaliar derrota, custos ou regras.

As ações usam o bloqueio transacional da partida: `set` substitui o valor
vigente na ordem serializada; `increment` soma ao valor vigente (zero quando
o contador ainda não existe), sem perder incrementos concorrentes. Reenvio
do mesmo UUID pelo mesmo jogador não reaplica o efeito. Snapshot, log e
intenção são gravados juntos antes da confirmação.

Jogador altera somente seus próprios valores. No campo, a permissão pertence
ao controlador; nas demais zonas, ao dono. Grimório não expõe instâncias:
para alterar uma carta nele, o jogador consulta as cartas primeiro. Contadores
da mão e da consulta privada não são enviados aos oponentes. Toda alteração
em carta produz registro genérico sem identificador, nome ou valor do contador,
evitando vazamento posterior quando a carta muda de visibilidade. Contadores
de jogadores e a vida são públicos.

O snapshot JSON recebe campos opcionais de contadores, compatíveis com
partidas antigas, sem migration ou dependência nova. Interface e respostas
usam o estado confirmado e o polling já existente.
