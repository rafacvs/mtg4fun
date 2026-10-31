import test from "node:test";
import assert from "node:assert/strict";
import {
  fallsOffTable,
  powerColor,
  powerFromHold,
} from "./diceThrowPower.ts";

test("segurar até 2 segundos é o lançamento normal", () => {
  for (const held of [0, 100, 1999, 2000]) assert.equal(powerFromHold(held), 0);
});

test("depois de 2 segundos a força sobe de 1 a 10 e para em 10", () => {
  assert.equal(powerFromHold(2001), 1);
  assert.equal(powerFromHold(2399), 1);
  assert.equal(powerFromHold(2400), 2);
  assert.equal(powerFromHold(4800), 8);
  assert.equal(powerFromHold(5200), 9);
  assert.equal(powerFromHold(5600), 10);
  assert.equal(powerFromHold(60000), 10);
});

test("só as forças 9 e 10 caem da mesa", () => {
  const falling = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(fallsOffTable);
  assert.deepEqual(falling, [9, 10]);
});

test("a cor vai do verde claro ao vermelho forte", () => {
  assert.equal(powerColor(1), "hsl(120 65% 78%)");
  assert.equal(powerColor(10), "hsl(0 90% 40%)");
});
