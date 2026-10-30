import { useEffect, useState } from "react";
import {
  preparationDiceApi,
  type PreparationState,
} from "./preparationDiceApi";

export function usePreparationDice(id: number, stopped: boolean) {
  const [state, setState] = useState<PreparationState>({
    phase: "preparing",
    rolls: [],
    confirmed: {},
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  useEffect(() => {
    if (stopped) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        const data = await preparationDiceApi.read(id, controller.signal);
        if (!controller.signal.aborted) {
          setState(data);
          setSyncError("");
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setSyncError(e instanceof Error ? e.message : "Falha de conexão.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(update, 700);
      }
    };
    void update();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, stopped]);
  async function send(
    kind: "roll" | "confirm",
    rollId?: string,
    fallOff = false,
  ) {
    setPending(true);
    setError("");
    try {
      await preparationDiceApi.send(id, kind, rollId, fallOff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setPending(false);
    }
  }
  return { state, pending, error: error || syncError, send };
}
