import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_ASPECT, CELL_GAP, STACK_SHIFT_X, battlefieldLayout, dropCell, firstFreeCell, fitBattlefield, projectBattlefield, viewExtent } from './battlefieldLayout.ts';

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

test('projection compacts only distant saved coordinates without mutating their destinations', () => {
  const cards = [card('first', 120, 4), card('near', 121, 4), card('far', 720, 18)];
  const projected = projectBattlefield(cards);

  assert.equal(projected.layout.cards.get('first')?.x, 0);
  assert.equal(projected.layout.cards.get('near')?.x, 1 + CELL_GAP);
  assert.equal(projected.layout.cards.get('far')?.y, 2 * (CARD_ASPECT + CELL_GAP));
  assert.deepEqual(projected.destination(0, 0), { column: 120, row: 4 });
  assert.deepEqual(projected.destination(0, 2), { column: 720, row: 18 });
  assert.deepEqual(cards.map(({ positionX, row }) => ({ positionX, row })), [
    { positionX: 120, row: 4 }, { positionX: 121, row: 4 }, { positionX: 720, row: 18 },
  ]);
});

test('a visão só rola quando as cartas não cabem, e nunca além de uma célula vazia', () => {
  const row = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `c${index}`, positionX: index, row: 0, stackOrder: index }));
  const cards = row(3);
  const fitted = fitBattlefield(cards, 8, 4);
  assert.ok(fitted.width > 8, 'as células vazias excedem a visão');
  assert.deepEqual(viewExtent(fitted, 8, 4), { width: 8, height: 4 });

  const narrow = fitBattlefield(cards, 3, 4);
  const occupied = 3 + 2 * CELL_GAP;
  assert.ok(Math.abs(viewExtent(narrow, 3, 4).width - (occupied + CELL_GAP + 1)) < 1e-9);
  assert.equal(viewExtent(narrow, 3, 4).height, 4);

  const low = fitBattlefield(cards, 8, 2 * CARD_ASPECT - .5);
  assert.ok(viewExtent(low, 8, 2 * CARD_ASPECT - .5).height === 2 * CARD_ASPECT - .5);
  assert.deepEqual(viewExtent(fitBattlefield([], 8, 4), 8, 4), { width: 8, height: 4 });

  // Under a high zoom the spare cell shrinks: at the far end the last card still fits.
  const zoomed = fitBattlefield(cards, 1.4, 4);
  const extent = viewExtent(zoomed, 1.4, 4).width;
  assert.ok(extent - 1.4 <= occupied - 1 + 1e-9, 'a última carta segue inteira no fim da rolagem');
  assert.ok(Math.abs(viewExtent(fitBattlefield(cards, 8, .8), 8, .8).height - CARD_ASPECT - CELL_GAP) < 1e-9);
  // Fitted exactly by "Centralizar": a rounding error must not open the scroll.
  assert.equal(viewExtent(fitBattlefield(cards, occupied - 1e-6, 4), occupied - 1e-6, 4).width, occupied - 1e-6);
});
