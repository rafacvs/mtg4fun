import type { Card } from './roomsApi';

// Persisted row/x define manual stacks. Reserve their actual rotated footprint
// in the presentation so nearby stacks never collide at any viewport or zoom.
export function battlefieldLayout(cards: Card[]) {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = `${card.row}:${card.positionX}`;
    groups.set(key, [...groups.get(key) ?? [], card]);
  }
  const sorted = [...groups.values()].sort((a, b) => a[0].row - b[0].row || a[0].positionX - b[0].positionX);
  const result = new Map<string, { x: number; index: number; size: number }>();
  let row = -1, cursor = 0;
  for (const group of sorted) {
    if (group[0].row !== row) { row = group[0].row; cursor = 0; }
    group.sort((a, b) => a.stackOrder - b.stackOrder || a.id.localeCompare(b.id));
    const x = Math.max(cursor, group[0].positionX);
    const width = Math.max(...group.map((card, index) => index * 14 + (card.tapped ? 72 * 88 / 63 : 72)));
    for (const [index, card] of group.entries()) result.set(card.id, { x, index, size: group.length });
    cursor = x + width + 10;
  }
  return result;
}
