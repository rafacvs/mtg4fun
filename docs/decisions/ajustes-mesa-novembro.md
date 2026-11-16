# Ajustes de inspeção, seleção e crônica

## Solicitação e aprovação

Em 16/11/2026, o usuário pediu que a inspeção apresente cartas viradas em pé,
que a seleção de criaturas mostre o dano total, que a área de seleção não se
sobreponha aos controles laterais, que a crônica agrupe o turno pela passagem
dos jogadores, que os comandantes da preparação sejam corrigidos e que o
jogador da vez receba borda dourada. Confirmou que o dano é a soma do poder
impresso com os ajustes; quando o poder não for numérico, o total deve aparecer
como indisponível. Seleções mistas conservam os controles anteriores.
Confirmou também considerar criatura uma ficha personalizada que tenha poder e
resistência preenchidos.

O usuário validou visualmente a borda dourada e pediu para realizar seus testes
antes da abertura de PR. As issues permanecem abertas para validação.

## Implementação

Eventos de troca de vez passam a incluir o identificador do próximo jogador,
sem alterar ações existentes. Para eventos anteriores, a crônica tenta recuperar
o destino a partir do nome registrado e da ordem de jogo. Nomes iguais em
eventos antigos podem impedir a reconstrução exata se houve jogadores pulados;
os novos eventos identificam o destino sem depender do nome.

Tipos de cartas conhecidas do catálogo são fornecidos na visualização já
autorizada da partida, respeitando a identidade visível ao observador. Fichas
personalizadas sem os dois valores não são classificadas como criaturas.

Na preparação, a identificação dos decks é atualizada a cada alteração e as
respostas antigas são ignoradas. A troca para a etapa seguinte não cancela uma
consulta ainda válida. A inspeção mantém o indicador de carta virada, mas exibe
a imagem em pé. No trilho, o contador de terrenos não fica sobre os controles
da seleção; em telas estreitas, a barra se reorganiza em duas linhas.

## Verificações em 16/11/2026

- Build e 41 testes unitários do frontend passaram.
- Testes de navegador passaram para a inspeção, a soma com fichas do catálogo
  e personalizadas, seleção mista, desktop e celular de 320 px, comandantes
  com respostas fora de ordem e crônica com recarga e correção de turno.
- A integração de turnos com jogadores sem vida passou. Na suíte Go completa,
  `TestTransferredSelectionPreservesZoneRulesAndRollsBack` falhou na expectativa
  de posição 520; a mesma falha já está registrada na
  [decisão de indicadores](indicadores-partida.md).
- O teste móvel `mobile-layout-320.spec.ts` falhou ao procurar o nome acessível
  “Desvirar todas”; na base `master` o botão já usa “Desvirar”.
