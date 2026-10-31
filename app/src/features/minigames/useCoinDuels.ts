import { useEffect, useRef, useState } from 'react';
import { useLiveChannel, useLiveClient } from '../live/LiveRoom';
import type { CoinSide } from '../rooms/CoinOptions';

export type CoinDuel = {
  id: number; challengerId: number; challengerName: string; opponentId: number; opponentName: string;
  confirmed: Record<string, CoinSide>; conflict: boolean;
};
export type CoinDuelNotice =
  | { key: string; kind: 'result'; side: CoinSide; winnerName: string; loserName: string }
  | { key: string; kind: 'cancelled'; message: string };

const resultMs = 6000;
const cancelledMs = 3500;

export function useCoinDuels(userId: number) {
  const client = useLiveClient();
  const [duels, setDuels] = useState<CoinDuel[]>([]);
  const [notices, setNotices] = useState<CoinDuelNotice[]>([]);
  const [target, setTarget] = useState<{ id: number; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  function notify(notice: CoinDuelNotice, duration: number) {
    // Em aba oculta nada se acumula para aparecer de uma vez na volta.
    if (document.visibilityState !== 'visible') return;
    setNotices(current => [...current, notice]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setNotices(current => current.filter(item => item.key !== notice.key));
    }, duration);
    timers.current.add(timer);
  }

  useLiveChannel('coin-duel', message => {
    if (message.type === 'snapshot' || message.type === 'state') setDuels(message.data.duels);
    if (message.type === 'result') notify({ key: `result-${message.data.duelId}`, kind: 'result', side: message.data.side, winnerName: message.data.winnerName, loserName: message.data.loserName }, resultMs);
    if (message.type === 'cancelled' && message.data.players.includes(userId)) notify({ key: `cancelled-${message.data.duelId}`, kind: 'cancelled', message: message.data.message }, cancelledMs);
  });

  const own = duels.find(duel => duel.challengerId === userId || duel.opponentId === userId) ?? null;
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
    own, target, notices, pending, error,
    panelOpen: !!own || !!target,
    prepare: (player: { id: number; name: string }) => { setError(''); setTarget({ id: player.id, name: player.name }); },
    dismiss: () => { setTarget(null); setError(''); },
    challenge: (opponentId: number) => act('challenge', { opponentId }),
    confirm: (side: CoinSide) => act('confirm', { side }),
    unconfirm: () => act('unconfirm'),
    cancel: () => act('cancel'),
  };
}
