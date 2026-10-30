import test from "node:test";
import assert from "node:assert/strict";
import { createDiceEngine } from "./dice/diceEngine.ts";

test("lançamento para fora termina com o valor do servidor e remove o dado", () => {
  for (const seed of [1, 17, 50, 909]) {
    let result = 0;
    const engine = createDiceEngine(null, {
      table: { cx: 400, cy: 250, radius: 280, tilt: 0.4 },
    });
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
