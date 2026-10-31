import test from "node:test";
import assert from "node:assert/strict";
import { createDiceEngine } from "./dice/diceEngine.ts";

const table = { cx: 400, cy: 250, radius: 280, tilt: 0.4 };
const seeds = [1, 17, 50, 909, 1730000000123];

test("lançamento para fora termina com o valor do servidor e remove o dado", () => {
  for (const seed of seeds) {
    let result = 0;
    const engine = createDiceEngine(null, { table });
    engine.toss({
      color: "#6cb4f5",
      value: 17,
      seed,
      fallOff: true,
      onLand: (value) => {
        result = value;
      },
    });
    for (let step = 0; step < 1200 && engine.count(); step++)
      engine.step(1 / 120);
    assert.equal(result, 17);
    assert.equal(engine.count(), 0);
    engine.destroy();
  }
});

test("forças 9 e 10 saem do feltro e nunca param nele", () => {
  for (const power of [9, 10])
    for (const seed of seeds) {
      const engine = createDiceEngine(null, { table });
      engine.toss({ color: "#6cb4f5", value: 12, seed, power, fallOff: true });
      let farthest = 0;
      for (let step = 0; step < 1200 && engine.count(); step++) {
        engine.step(1 / 120);
        for (const die of engine.snapshot()) {
          assert.equal(die.st, "fly");
          farthest = Math.max(farthest, Math.hypot(die.p[0], die.p[1]));
        }
      }
      assert.equal(engine.count(), 0);
      assert.ok(farthest > table.radius, `força ${power}, semente ${seed}`);
      engine.destroy();
    }
});

test("dado perdido não para ao bater em dados parados no caminho", () => {
  for (const seed of seeds) {
    const engine = createDiceEngine(null, { table, restMs: 60000 });
    for (let i = 0; i < 12; i++)
      engine.toss({ color: "#4fd1b0", value: 3, seed: seed + i + 1 });
    for (let step = 0; step < 600; step++) engine.step(1 / 120);
    const resting = engine.count();
    let landed = 0;
    engine.toss({
      color: "#6cb4f5",
      value: 12,
      seed,
      power: 10,
      fallOff: true,
      onLand: (value) => {
        landed = value;
      },
    });
    for (let step = 0; step < 300 && !landed; step++) engine.step(1 / 120);
    assert.equal(landed, 12);
    assert.equal(engine.count(), resting);
    engine.destroy();
  }
});

test("tiro em dados parados não lança o dado para fora da tela", () => {
  for (const seed of seeds) {
    const engine = createDiceEngine(null, { table, restMs: 60000 });
    for (let i = 0; i < 12; i++)
      engine.toss({ color: "#4fd1b0", value: 3, seed: seed + i + 1 });
    for (let step = 0; step < 600; step++) engine.step(1 / 120);
    engine.toss({ color: "#6cb4f5", value: 12, seed, power: 8 });
    for (let step = 0; step < 300; step++) {
      engine.step(1 / 120);
      for (const die of engine.snapshot())
        assert.ok(die.p[2] < table.radius, `semente ${seed}: ${die.p[2]}`);
    }
    engine.destroy();
  }
});

test("forças de 1 a 8 ficam na mesa e param no valor do servidor", () => {
  for (let power = 1; power <= 8; power++)
    for (const seed of seeds) {
      let result = 0;
      const engine = createDiceEngine(null, { table });
      engine.toss({
        color: "#6cb4f5",
        value: 12,
        seed,
        power,
        onLand: (value) => {
          result = value;
        },
      });
      for (let step = 0; step < 3000 && !result; step++) {
        engine.step(1 / 120);
        const [die] = engine.snapshot();
        assert.ok(Math.hypot(die.p[0], die.p[1]) <= table.radius);
      }
      assert.equal(result, 12);
      assert.equal(engine.count(), 1);
      engine.destroy();
    }
});

const launch = (power: number | undefined, seed = 17) => {
  const engine = createDiceEngine(null, { table });
  engine.toss({ color: "#6cb4f5", seed, power });
  const [die] = engine.snapshot();
  engine.destroy();
  return { speed: Math.hypot(die.v[0], die.v[1]), lift: die.v[2] };
};

/** Quanto o dado avançou em direção ao outro lado da mesa, em raios. */
const landingDepth = (power: number | undefined, seed: number) => {
  const engine = createDiceEngine(null, { table, restMs: 60000 });
  let landed = false;
  engine.toss({
    color: "#6cb4f5",
    value: 12,
    seed,
    power,
    onLand: () => {
      landed = true;
    },
  });
  for (let step = 0; step < 3000 && !landed; step++) engine.step(1 / 120);
  const [die] = engine.snapshot();
  engine.destroy();
  return die.p[1] / table.radius;
};

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

test("cada nível de força lança mais rápido", () => {
  for (let power = 2; power <= 10; power++)
    assert.ok(launch(power).speed > launch(power - 1).speed);
});

test("o clique normal é igual à força 4 e cai no meio da mesa", () => {
  assert.deepEqual(launch(undefined), launch(4));
  for (const seed of seeds) {
    const depth = landingDepth(undefined, seed);
    assert.ok(Math.abs(depth) < 0.35, `semente ${seed}: ${depth}`);
  }
});

test("forças baixas caem na frente do jogador, mais perto quanto menor", () => {
  for (const seed of seeds) {
    const depth = landingDepth(1, seed);
    assert.ok(depth > 0.55, `semente ${seed}: ${depth}`);
  }
  const depths = [1, 2, 3, 4, 5].map((power) =>
    average(seeds.map((seed) => landingDepth(power, seed))),
  );
  for (let i = 1; i < depths.length; i++)
    assert.ok(depths[i] < depths[i - 1], depths.join(", "));
});

test("forças altas saem retas, como um tiro", () => {
  assert.ok(launch(10).lift < launch(4).lift / 2);
  assert.ok(launch(10).speed > launch(4).speed * 5);
});

test("o tiro continua ricocheteando depois que o clique já parou", () => {
  const seconds = (power: number, seed: number) => {
    const engine = createDiceEngine(null, { table });
    let landed = false;
    engine.toss({
      color: "#6cb4f5",
      value: 12,
      seed,
      power,
      onLand: () => {
        landed = true;
      },
    });
    let step = 0;
    for (; step < 3000 && !landed; step++) engine.step(1 / 120);
    engine.destroy();
    return step / 120;
  };
  for (const seed of seeds)
    assert.ok(seconds(8, seed) > seconds(4, seed) * 1.8, `semente ${seed}`);
});
