import test from "node:test";
import assert from "node:assert/strict";
import { createDiceEngine } from "./dice/diceEngine.ts";

const table = { cx: 400, cy: 250, radius: 280, tilt: 0.4 };
const seeds = [1, 17, 50, 909, 1730000000123];

test("tiro em dados parados não lança o dado para fora da tela", () => {
  for (const seed of seeds) {
    const engine = createDiceEngine(null, { table, restMs: 60000 });
    for (let i = 0; i < 12; i++)
      engine.toss({ color: "#4fd1b0", value: 3, seed: seed + i + 1 });
    for (let step = 0; step < 600; step++) engine.step(1 / 120);
    engine.toss({ color: "#6cb4f5", value: 12, seed, power: 10 });
    for (let step = 0; step < 300; step++) {
      engine.step(1 / 120);
      for (const die of engine.snapshot())
        assert.ok(die.p[2] < table.radius, `semente ${seed}: ${die.p[2]}`);
    }
    engine.destroy();
  }
});

test("todas as forças ficam na mesa e param no valor do servidor", () => {
  for (let power = 1; power <= 10; power++)
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

test("cada lançamento desvia para um lado, no máximo 30 graus do reto", () => {
  const limit = Math.PI / 6 + 1e-9;
  for (const [fromAngle, inward] of [
    [0, [0, -1]],
    [Math.PI, [0, 1]],
    [Math.PI / 2, [-1, 0]],
    [-Math.PI / 2, [1, 0]],
  ] as [number, [number, number]][]) {
    const deviations: number[] = [];
    for (let i = 0; i < 300; i++) {
      const engine = createDiceEngine(null, { table });
      engine.toss({
        color: "#6cb4f5",
        // a semente real é o horário da rolagem em milissegundos
        seed: 1730000000123 + i * 1537,
        fromAngle,
        power: (i % 10) + 1,
      });
      const [die] = engine.snapshot();
      engine.destroy();
      const forward = die.v[0] * inward[0] + die.v[1] * inward[1];
      const sideways = die.v[0] * inward[1] - die.v[1] * inward[0];
      deviations.push(Math.atan2(sideways, forward));
    }
    assert.ok(deviations.every((value) => Math.abs(value) <= limit));
    assert.ok(Math.min(...deviations) < -Math.PI / 9);
    assert.ok(Math.max(...deviations) > Math.PI / 9);
  }
});

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

test("o verde vai para a frente, sem chegar ao meio, e o clique passa dele", () => {
  for (const seed of seeds) {
    const weakest = landingDepth(1, seed);
    assert.ok(weakest > 0.25 && weakest < 0.7, `semente ${seed}: ${weakest}`);
    assert.ok(landingDepth(undefined, seed) < weakest, `semente ${seed}`);
  }
  const depths = [1, 2, 3, 4].map((power) =>
    average(seeds.map((seed) => landingDepth(power, seed))),
  );
  for (let i = 1; i < depths.length; i++)
    assert.ok(depths[i] < depths[i - 1], depths.join(", "));
});

test("só o aro no chão dá um pulinho; no alto a parede não mexe na subida", () => {
  let onRim = 0,
    inAir = 0;
  for (const power of [5, 6, 7, 8])
    for (const seed of seeds) {
      const engine = createDiceEngine(null, { table, restMs: 60000 });
      engine.toss({ color: "#6cb4f5", value: 12, seed, power });
      for (let step = 0; step < 3000; step++) {
        const [before] = engine.snapshot();
        const speed = Math.hypot(before.v[0], before.v[1]);
        const outward = before.p[0] * before.v[0] + before.p[1] * before.v[1];
        const lift = before.v[2];
        const height = before.p[2];
        engine.step(1 / 120);
        const [after] = engine.snapshot();
        const inward = after.p[0] * after.v[0] + after.p[1] * after.v[1];
        if (outward <= 0 || inward >= 0 || speed < 300) continue;
        const label = `força ${power}, semente ${seed}, altura ${height}`;
        if (height > 28 * 2.5) {
          inAir++;
          assert.ok(after.v[2] <= lift, label);
        } else if (height < 28 * 1.2 && after.p[2] < 28 * 1.2) {
          onRim++;
          assert.ok(after.v[2] > 0, `${label}: ${after.v[2]}`);
          assert.ok(after.v[2] <= 900, `${label}: ${after.v[2]}`);
        }
        assert.ok(Math.hypot(after.v[0], after.v[1]) > speed * 0.35, label);
      }
      engine.destroy();
    }
  assert.ok(onRim > 0, "nenhuma batida no aro");
  assert.ok(inAir > 0, "nenhuma batida no alto");
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

/** Pulos do dado até parar e a maior altura que ele alcança. */
const flight = (power: number | undefined, seed: number, fromAngle = 0) => {
  const engine = createDiceEngine(null, { table });
  let landed = false;
  engine.toss({
    color: "#6cb4f5",
    value: 12,
    seed,
    power,
    fromAngle,
    onLand: () => {
      landed = true;
    },
  });
  let hops = 0,
    peak = 0,
    falling = false,
    highestOnScreen = Infinity;
  for (let step = 0; step < 3000 && !landed; step++) {
    engine.step(1 / 120);
    const [die] = engine.snapshot();
    if (falling && die.v[2] > 0) hops++;
    falling = die.v[2] < 0;
    peak = Math.max(peak, die.p[2]);
    const cameraTilt = Math.sqrt(1 - table.tilt * table.tilt);
    highestOnScreen = Math.min(
      highestOnScreen,
      table.cy + die.p[1] * table.tilt - die.p[2] * cameraTilt,
    );
  }
  engine.destroy();
  return { hops, peak, highestOnScreen };
};

test("o clique quica à vista e não só escorrega", () => {
  for (const seed of seeds) {
    const { hops, peak } = flight(undefined, seed);
    assert.ok(hops >= 3, `semente ${seed}: ${hops} pulos`);
    assert.ok(peak > 60, `semente ${seed}: altura ${peak}`);
  }
});

test("quanto maior a força, mais o dado pula", () => {
  const hops = (power: number) =>
    average(seeds.map((seed) => flight(power, seed).hops));
  assert.ok(hops(1) < hops(4));
  assert.ok(hops(4) < hops(7));
  assert.ok(hops(7) < hops(8));
});

test("forças fracas também pulam, sem chegar à altura do clique", () => {
  for (const seed of seeds) {
    const weak = flight(1, seed);
    assert.ok(weak.hops >= 1, `semente ${seed}`);
    assert.ok(weak.peak < flight(4, seed).peak, `semente ${seed}`);
  }
});

test("o pulo mais alto continua dentro do canvas", () => {
  for (let power = 1; power <= 10; power++)
    for (const [fromAngle, seed] of [
      [0, 1],
      [Math.PI, 17],
      [2.2, 909],
    ])
      assert.ok(
        flight(power, seed, fromAngle).highestOnScreen > 0,
        `força ${power}, ângulo ${fromAngle}`,
      );
});

test("do clique ao laranja, o lançamento fica mais reto e bem mais forte", () => {
  const steepness = (power: number) =>
    average(
      seeds.map((seed) => {
        const { lift, speed } = launch(power, seed);
        return lift / speed;
      }),
    );
  assert.ok(steepness(7) < steepness(4) / 2.5);
  assert.ok(steepness(8) < steepness(7));
  assert.ok(launch(7).speed > launch(4).speed * 3);
  assert.ok(launch(10).speed > launch(4).speed * 5);
});

test("o laranja sobe só um pouco mais que o clique, e o verde quase não sobe", () => {
  for (const seed of seeds) {
    const click = flight(undefined, seed).peak;
    const orange = flight(7, seed).peak;
    assert.ok(orange > click * 0.95 && orange < click * 1.5, `semente ${seed}`);
    assert.ok(flight(1, seed).peak < click * 0.65, `semente ${seed}`);
    assert.ok(flight(1, seed).hops <= 2, `semente ${seed}`);
  }
});
