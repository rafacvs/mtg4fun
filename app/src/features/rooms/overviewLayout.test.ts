import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_ASPECT, battlefieldLayout } from './battlefieldLayout.ts';
import { overviewLayout } from './overviewLayout.ts';

const card = (id: string, positionX: number, row: number, stackOrder = 0, tapped = false) => ({ id, positionX, row, stackOrder, tapped });

test('sparse saved positions keep cards legible in a miniature without rewriting them', () => {
  const cards = [card('left', 0, 0), card('middle', 120, 0), card('right', 720, 0), card('bottom', 240, 100)];
  const original = structuredClone(cards);
  const layout = overviewLayout(cards);
  // At a 300px-wide preview, these three columns must be recognisable cards,
  // rather than subpixel slivers caused by hundreds of empty grid cells.
  assert.ok(300 / layout.width >= 40);
  assert.ok(layout.height < 5);
  assert.ok(layout.cards.get('left')!.x < layout.cards.get('middle')!.x);
  assert.ok(layout.cards.get('middle')!.x < layout.cards.get('right')!.x);
  assert.ok(layout.cards.get('bottom')!.y > layout.cards.get('left')!.y);
  assert.deepEqual(cards, original);
});

test('a compact grid keeps the field geometry, including mixed stacks and tapped cards', () => {
  const cards = [card('top', 0, 0), card('base', 0, 1), card('tapped', 0, 1, 1, true), card('third', 0, 1, 2), card('neighbor', 1, 1)];
  const layout = overviewLayout(cards);
  assert.deepEqual(layout, battlefieldLayout(cards, 0, 0));
  const neighbor = layout.cards.get('neighbor')!;
  assert.ok(neighbor.x > layout.cards.get('tapped')!.x + CARD_ASPECT);
  assert.ok(layout.cards.get('base')!.index < layout.cards.get('third')!.index);
});

test('an empty field still has no cards to render', () => {
  const layout = overviewLayout([]);
  assert.equal(layout.cards.size, 0);
  assert.equal(layout.width, 0);
  assert.equal(layout.height, 0);
});
