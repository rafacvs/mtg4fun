import { createActionIntent } from "./actionIntent";

export type PreparationRoll = {
  power?: number;
  id: string;
  playerId: number;
  name: string;
  value: number;
  seed: number;
  phase: string;
  at: number;
};
export type PreparationState = {
  phase: string;
  rolls: PreparationRoll[] | null;
  confirmed: Record<string, string> | null;
};
export const preparationDiceApi = {
  async read(id: number, signal: AbortSignal): Promise<PreparationState> {
    const res = await fetch(`/api/rooms/${id}/preparation`, { signal });
    if (!res.ok) throw new Error("Não foi possível sincronizar as rolagens.");
    return res.json();
  },
  async decks(
    id: number,
  ): Promise<{ decks: { playerId: number; name: string; image?: string }[] }> {
    const res = await fetch(`/api/rooms/${id}/preparation-decks`);
    if (!res.ok) throw new Error("Não foi possível carregar os decks.");
    return res.json();
  },
  async send(
    id: number,
    kind: "roll" | "confirm",
    rollId?: string,
    power = 0,
  ) {
    const body = JSON.stringify({
      kind,
      intentId: createActionIntent(),
      ...(kind === "confirm" ? { rollId } : {}),
      ...(kind === "roll" && power ? { power } : {}),
    });
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(`/api/rooms/${id}/preparation/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(15000),
        });
        break;
      } catch (e) {
        if (attempt === 1) throw e;
      }
    }
    const data = await response!.json();
    if (!response!.ok) throw new Error(data.error);
  },
};
