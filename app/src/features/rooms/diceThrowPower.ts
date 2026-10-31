export const NORMAL_HOLD_MS = 1000;
export const MAX_POWER = 10;
export const FIRST_FALL_OFF_POWER = 9;
const FIRST_SWEEP_MS = 1200;
const SPEEDUP_MS = 2000;
const STEPS_PER_SWEEP = MAX_POWER - 1;

/**
 * Até 1 s é o lançamento normal (0). Depois, a força vai de 1 a 10 e volta de 10
 * a 1 sem parar. A velocidade cresce sem limite: quem segura demais perde o controle.
 */
export function powerFromHold(heldMs: number) {
  if (heldMs <= NORMAL_HOLD_MS) return 0;
  const charging = heldMs - NORMAL_HOLD_MS;
  const sweeps =
    charging / FIRST_SWEEP_MS + (charging / SPEEDUP_MS) ** 2;
  const sweep = Math.floor(sweeps);
  const moved = Math.floor((sweeps - sweep) * STEPS_PER_SWEEP);
  return sweep % 2 === 0 ? 1 + moved : MAX_POWER - moved;
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
