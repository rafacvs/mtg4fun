import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_ASPECT, CELL_GAP, STACK_SHIFT_X, battlefieldLayout, dropCell, firstFreeCell, fitBattlefield } from './battlefieldLayout.ts';

const card = (id: string, positionX: number, row: number, tapped = false) => ({ id, positionX, row, stackOrder: 0, tapped });

test('a tapped card widens only its own row', () => {
  const layout = battlefieldLayout([
    card('land', 0, 0),
    card('creature', 1, 0),
    card('tapped', 0, 1, true),
    card('artifact', 1, 1),
  ], 0, 0);
  const land = layout.cards.get('creature')!;
  const artifact = layout.cards.get('artifact')!;
  assert.ok(land.x < artifact.x);
  assert.ok(Math.abs(land.x - (1 + CELL_GAP)) < 0.001);
  assert.ok(artifact.x > CARD_ASPECT);
});

test('a stack of three pushes the next card on that row and leaves the row above', () => {
  const layout = battlefieldLayout([
    card('top', 0, 0),
    { ...card('mid', 0, 1), stackOrder: 1 },
    { ...card('low', 0, 1), stackOrder: 0 },
    { ...card('third', 0, 1), stackOrder: 2 },
    card('neighbor', 1, 1),
    card('above', 1, 0),
  ], 0, 0);
  const above = layout.cards.get('above')!;
  const neighbor = layout.cards.get('neighbor')!;
  assert.ok(neighbor.x > above.x);
  assert.ok(neighbor.x > 1 + 2 * STACK_SHIFT_X);
});

test('an empty column keeps a one-card gap and padding stays droppable', () => {
  const layout = battlefieldLayout([card('far', 2, 0)], 2, 2);
  const far = layout.cards.get('far')!;
  assert.ok(far.x > 2);
  const hole = dropCell(layout, 0.2, 0.2);
  assert.deepEqual(hole, { column: 0, row: 0 });
  const full = battlefieldLayout([
    { ...card('a', 0, 0), stackOrder: 0 },
    { ...card('b', 0, 0), stackOrder: 1 },
    { ...card('c', 0, 0), stackOrder: 2 },
  ], 2, 2);
  assert.deepEqual(dropCell(full, 0.2, 0.2), { column: 1, row: 0 });
});

test('the first open cell is the leftmost stack on the top row with room', () => {
  assert.deepEqual(firstFreeCell([]), { column: 0, row: 0 });
  assert.deepEqual(firstFreeCell([
    { positionX: 0, row: 0 }, { positionX: 0, row: 0 }, { positionX: 0, row: 0 },
    { positionX: 2, row: 0 },
  ]), { column: 1, row: 0 });
});

test('the field grows until it covers the visible area', () => {
  const layout = fitBattlefield([card('only', 0, 0)], 8, 6);
  assert.ok(layout.width >= 8);
  assert.ok(layout.height >= 6);
});
