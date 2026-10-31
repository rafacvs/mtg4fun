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

const sequence = (untilMs: number) => {
  const levels: { level: number; at: number }[] = [];
  for (let held = 2001; held <= untilMs; held++) {
    const level = powerFromHold(held);
    if (levels.at(-1)?.level !== level) levels.push({ level, at: held });
  }
  return levels;
};

test("depois de 2 segundos a força sobe de 1 a 10 e volta de 10 a 1", () => {
  assert.deepEqual(
    sequence(5570).map(({ level }) => level),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  );
});

test("a força nunca sai da escala nem volta a ser o lançamento normal", () => {
  for (let held = 2001; held < 120000; held += 7) {
    const level = powerFromHold(held);
    assert.ok(level >= 1 && level <= 10, `${held} ms: ${level}`);
  }
});

test("cada passada é mais rápida que a anterior", () => {
  const levels = sequence(14000);
  const extremes = levels.filter(
    ({ level }, index) =>
      (level === 1 || level === 10) && (index > 0 || level === 1),
  );
  const sweeps = extremes
    .slice(1)
    .map((extreme, index) => extreme.at - extremes[index].at);
  assert.ok(sweeps.length > 6, sweeps.join(", "));
  for (let i = 1; i < 6; i++)
    assert.ok(sweeps[i] < sweeps[i - 1], sweeps.join(", "));
});

test("segurar por muito tempo continua trocando de nível", () => {
  const start = 3_600_000;
  const seen = new Set<number>();
  for (let held = start; held < start + 1000; held += 5)
    seen.add(powerFromHold(held));
  assert.equal(seen.size, 10);
});

test("só as forças 9 e 10 caem da mesa", () => {
  const falling = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(fallsOffTable);
  assert.deepEqual(falling, [9, 10]);
});

test("a cor vai do verde claro ao vermelho forte", () => {
  assert.equal(powerColor(1), "hsl(120 65% 78%)");
  assert.equal(powerColor(10), "hsl(0 90% 40%)");
});
