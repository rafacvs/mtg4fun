import { useEffect, useRef, useState } from 'react';
import { roomsApi, UnconfirmedActionError, type Match } from './roomsApi';

export function useMatch(roomId: number) {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const pending = useRef<(() => Promise<Match>) | null>(null);
  const acting = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    let active = true;
    let reading = false;
    mounted.current = true;
    async function refresh() {
      if (acting.current || reading) return;
      reading = true;
      const startedAt = revision.current;
      try {
        const value = await roomsApi.match(roomId);
        if (active && startedAt === revision.current) { setMatch(value); setSyncError(''); }
      } catch (reason) {
        if (active && startedAt === revision.current) setSyncError((reason as Error).message);
      } finally { reading = false; }
    }
    void refresh();
    const polling = window.setInterval(() => void refresh(), 1000);
    return () => { active = false; mounted.current = false; window.clearInterval(polling); };
  }, [roomId]);

  async function act(operation: () => Promise<Match>, retrying = false) {
    if (acting.current || pending.current && !retrying) return false;
    acting.current = true;
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      const confirmed = await operation();
      pending.current = null;
      if (mounted.current) { setMatch(confirmed); setSyncError(''); setUnconfirmed(false); }
      return true;
    } catch (reason) {
      pending.current = reason instanceof UnconfirmedActionError ? operation : null;
      if (mounted.current) { setError((reason as Error).message); setUnconfirmed(pending.current !== null); }
      return false;
    } finally {
      acting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    match, error: error || syncError, busy, unconfirmed,
    retry: () => pending.current ? act(pending.current, true) : Promise.resolve(false),
    draw: (count: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.draw(roomId, count, intentId));
    },
    move: (ids: string[], to: string, placement?: 'top' | 'bottom') => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.move(roomId, ids, to, intentId, placement));
    },
    roll: (sides: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.roll(roomId, sides, intentId));
    },
    coin: () => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.coin(roomId, intentId));
    },
    turn: (direction: 'next' | 'previous') => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.turn(roomId, direction, intentId));
    },
    consult: (from: 'all' | 'top' | 'bottom', count: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.consult(roomId, from, count, intentId));
    },
    reorder: (ids: string[]) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.reorder(roomId, ids, intentId));
    },
    closeConsultation: (placement: 'top' | 'bottom', shuffle: boolean) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.closeConsultation(roomId, placement, shuffle, intentId));
    },
    reveal: (count: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.reveal(roomId, count, intentId));
    },
  };
}
