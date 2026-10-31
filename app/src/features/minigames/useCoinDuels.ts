import { useEffect, useRef, useState } from 'react';
import { useLiveChannel, useLiveClient } from '../live/LiveRoom';
import type { CoinSide } from '../rooms/CoinOptions';

export type CoinDuel = {
  id: number; status: 'invited' | 'playing';
  challengerId: number; challengerName: string; opponentId: number; opponentName: string;
  picks: Record<string, CoinSide>; confirmed: Record<string, boolean>; conflict: boolean;
};
export type CoinDuelOutcome = {
  duelId: number; kind: 'flip' | 'forfeit' | 'refused'; side?: CoinSide;
  loserId: number; loserName: string; loserSide?: CoinSide;
  winnerId: number; winnerName: string; winnerSide?: CoinSide; at: number;
};
type DuelState = { duels: CoinDuel[]; marks: Record<string, 'lost' | 'refused'>; history: CoinDuelOutcome[] };

export const coinFlightMs = 1400;
const resultScreenMs = 3600;
const bannerMs = 6000;
const noticeMs = 3500;

// O registro da sala precisa só do histórico, em outro ponto da árvore.
export function useDuelHistory() {
  const [history, setHistory] = useState<CoinDuelOutcome[]>([]);
  useLiveChannel('coin-duel', message => {
    if (message.type === 'snapshot' || message.type === 'state') setHistory((message.data as DuelState).history);
  });
  return history;
}

export function useCoinDuels(userId: number) {
  const client = useLiveClient();
  const [state, setState] = useState<DuelState>({ duels: [], marks: {}, history: [] });
  const [flip, setFlip] = useState<CoinDuelOutcome | null>(null);
  const [banner, setBanner] = useState<CoinDuelOutcome | null>(null);
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState<{ id: number; name: string; anchor: HTMLElement | null } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  function later(run: () => void, delay: number) {
    const timer = setTimeout(() => { timers.current.delete(timer); run(); }, delay);
    timers.current.add(timer);
  }

  function showBanner(outcome: CoinDuelOutcome) {
    setBanner(outcome);
    later(() => setBanner(current => current === outcome ? null : current), bannerMs);
  }

  function received(outcome: CoinDuelOutcome) {
    // Em aba oculta nada se acumula para aparecer de uma vez na volta.
    if (document.visibilityState !== 'visible') return;
    if (outcome.kind !== 'flip' || (outcome.winnerId !== userId && outcome.loserId !== userId)) { showBanner(outcome); return; }
    setFlip(outcome);
    later(() => { setFlip(null); showBanner(outcome); }, coinFlightMs + resultScreenMs);
  }

  useLiveChannel('coin-duel', message => {
    if (message.type === 'snapshot' || message.type === 'state') setState(message.data);
    if (message.type === 'result') received(message.data);
    if (message.type === 'cancelled' && message.data.players.includes(userId) && document.visibilityState === 'visible') {
      setNotice(message.data.message);
      later(() => setNotice(''), noticeMs);
    }
  });

  const own = state.duels.find(duel => duel.challengerId === userId || duel.opponentId === userId) ?? null;
  useEffect(() => { if (own) setTarget(null); setError(''); }, [own?.id]);

  async function act(type: string, data?: unknown) {
    setPending(true);
    setError('');
    try {
      await client.request('coin-duel', type, data);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    own, flip, banner, notice, target, pending, error, marks: state.marks,
    panelOpen: !!own || !!target || !!flip,
    prepare: (player: { id: number; name: string }, anchor: HTMLElement | null = null) => { setError(''); setTarget({ id: player.id, name: player.name, anchor }); },
    dismiss: () => { setTarget(null); setError(''); },
    challenge: (opponentId: number) => act('challenge', { opponentId }),
    accept: () => act('accept'),
    refuse: () => act('refuse'),
    pick: (side: CoinSide) => act('pick', { side }),
    confirm: () => act('confirm'),
    unconfirm: () => act('unconfirm'),
    forfeit: () => act('forfeit'),
    cancel: () => act('cancel'),
  };
}
