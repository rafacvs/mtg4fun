import { useState } from "react";
import { useLiveChannel, useLiveStatus } from "../live/LiveRoom";
import {
  preparationDiceApi,
  type PreparationState,
  type ReceivedPreparationState,
} from "./preparationDiceApi";

export function usePreparationDice(id: number, stopped: boolean) {
  const [state, setState] = useState<ReceivedPreparationState>({
    phase: "preparing",
    rolls: [],
    confirmed: {},
    source: "snapshot",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const status = useLiveStatus();
  useLiveChannel("dice", (message) => {
    if (stopped || (message.type !== "snapshot" && message.type !== "state"))
      return;
    setState({
      ...(message.data as PreparationState),
      source: message.type === "state" ? "live" : "snapshot",
    });
  });
  async function send(
    kind: "roll" | "confirm" | "unconfirm",
    rollId?: string,
    power = 0,
  ) {
    setPending(true);
    setError("");
    try {
      await preparationDiceApi.send(id, kind, rollId, power);
      // O botão troca de ação junto com a resposta, mesmo com a sala reconectando.
      const current = await preparationDiceApi.read(
        id,
        AbortSignal.timeout(15000),
      );
      setState({ ...current, source: "live" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setPending(false);
    }
  }
  const syncError =
    !stopped && status === "reconnecting"
      ? "Conexão com a sala interrompida. Reconectando…"
      : "";
  return { state, pending, error: error || syncError, send };
}
