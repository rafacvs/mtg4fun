export const NORMAL_HOLD_MS = 2000;
export const POWER_STEP_MS = 400;
export const MAX_POWER = 10;
export const FIRST_FALL_OFF_POWER = 9;

/** Até 2 s é o lançamento normal (0); depois, sobe um nível a cada 400 ms até 10. */
export function powerFromHold(heldMs: number) {
  if (heldMs <= NORMAL_HOLD_MS) return 0;
  const level = 1 + Math.floor((heldMs - NORMAL_HOLD_MS) / POWER_STEP_MS);
  return Math.min(MAX_POWER, level);
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
