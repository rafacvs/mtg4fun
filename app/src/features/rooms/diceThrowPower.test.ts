import test from "node:test";
import assert from "node:assert/strict";
import {
  fallsOffTable,
  powerColor,
  powerFromHold,
} from "./diceThrowPower.ts";

test("segurar até 1 segundo é o lançamento normal", () => {
  for (const held of [0, 100, 999, 1000]) assert.equal(powerFromHold(held), 0);
});

const sequence = (untilMs: number) => {
  const levels: { level: number; at: number }[] = [];
  for (let held = 1001; held <= untilMs; held++) {
    const level = powerFromHold(held);
    if (levels.at(-1)?.level !== level) levels.push({ level, at: held });
  }
  return levels;
};

test("a força sobe de 1 a 10 em cerca de 1 segundo e volta de 10 a 1", () => {
  const levels = sequence(2620);
  const firstTop = levels.findIndex(({ level }) => level === 10);
  assert.ok(levels[firstTop].at < 2000, `${levels[firstTop].at} ms`);
  assert.deepEqual(
    levels.map(({ level }) => level),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  );
});

test("a força nunca sai da escala nem volta a ser o lançamento normal", () => {
  for (let held = 1001; held < 120000; held += 7) {
    const level = powerFromHold(held);
    assert.ok(level >= 1 && level <= 10, `${held} ms: ${level}`);
  }
});

test("cada passada é mais rápida que a anterior", () => {
  const levels = sequence(8000);
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

test("a carga não tem velocidade máxima", () => {
  const changesIn100Ms = (start: number) => {
    let changes = 0;
    for (let held = start; held < start + 100; held += 0.05)
      if (powerFromHold(held) !== powerFromHold(held + 0.05)) changes++;
    return changes;
  };
  const rates = [5000, 20000, 60000, 240000].map(changesIn100Ms);
  for (let i = 1; i < rates.length; i++)
    assert.ok(rates[i] > rates[i - 1] * 2, rates.join(", "));
});

test("só as forças 9 e 10 caem da mesa", () => {
  const falling = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(fallsOffTable);
  assert.deepEqual(falling, [9, 10]);
});

test("a cor vai do verde claro ao vermelho forte", () => {
  assert.equal(powerColor(1), "hsl(120 65% 78%)");
  assert.equal(powerColor(10), "hsl(0 90% 40%)");
});
