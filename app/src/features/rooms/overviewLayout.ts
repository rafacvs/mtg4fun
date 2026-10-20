import { battlefieldLayout } from './battlefieldLayout.ts';
import type { Card } from './roomsApi';

type OverviewCard = Pick<Card, 'id' | 'positionX' | 'row' | 'stackOrder' | 'tapped'>;

// Keep one empty cell between separated groups in the miniature. Sparse or
// legacy coordinates must not shrink every card to a fraction of a pixel.
function compactAxis(values: number[]) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  let next = 0;
  return new Map(sorted.map((value, index) => {
    if (index > 0) next += Math.min(value - sorted[index - 1], 2);
    return [value, next];
  }));
}

export function overviewLayout(cards: OverviewCard[]) {
  const rows = compactAxis(cards.map(card => card.row));
  const columns = new Map([...rows.keys()].map(row => [row, compactAxis(cards.filter(card => card.row === row).map(card => card.positionX))]));
  return battlefieldLayout(cards.map(card => ({
    ...card,
    positionX: columns.get(card.row)!.get(card.positionX)!,
    row: rows.get(card.row)!,
  })), 0, 0);
}
