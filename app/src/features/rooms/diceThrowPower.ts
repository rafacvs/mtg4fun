export const NORMAL_HOLD_MS = 2000;
export const MAX_POWER = 10;
export const FIRST_FALL_OFF_POWER = 9;
const FIRST_STEP_MS = 220;
const STEP_SPEEDUP = 0.8;
const FASTEST_STEP_MS = 40;
const STEPS_PER_SWEEP = MAX_POWER - 1;

/**
 * Até 2 s é o lançamento normal (0). Depois, a força vai de 1 a 10 e volta de 10
 * a 1 sem parar, com cada passada mais rápida que a anterior.
 */
export function powerFromHold(heldMs: number) {
  if (heldMs <= NORMAL_HOLD_MS) return 0;
  let elapsed = heldMs - NORMAL_HOLD_MS;
  let step = FIRST_STEP_MS;
  let rising = true;
  while (elapsed >= step * STEPS_PER_SWEEP) {
    elapsed -= step * STEPS_PER_SWEEP;
    step = Math.max(FASTEST_STEP_MS, step * STEP_SPEEDUP);
    rising = !rising;
  }
  const moved = Math.floor(elapsed / step);
  return rising ? 1 + moved : MAX_POWER - moved;
}

export function fallsOffTable(power: number) {
  return power >= FIRST_FALL_OFF_POWER;
}

/** Do verde clarinho (1) ao vermelho forte (10), passando pelo amarelo. */
export function powerColor(power: number) {
  const progress = (power - 1) / (MAX_POWER - 1);
  const hue = 120 * (1 - progress);
  const saturation = 65 + 25 * progress;
  const lightness = 78 - 38 * progress;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function powerTextColor(power: number) {
  return power >= FIRST_FALL_OFF_POWER ? "#fff6df" : "#14170f";
}
