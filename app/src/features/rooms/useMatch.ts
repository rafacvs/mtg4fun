import { useEffect, useRef, useState } from 'react';
import { roomsApi, UnconfirmedActionError, type CounterAction, type CustomToken, type Match } from './roomsApi';

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
    finish: () => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.finish(roomId, intentId));
    },
    setTapped: (cardIds: string[], tapped: boolean) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.setTapped(roomId, cardIds, tapped, intentId));
    },
    hideAllRevealed: () => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.hideAllRevealed(roomId, intentId));
    },
    untapAll: () => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.untapAll(roomId, intentId));
    },
    setFace: (cardId: string, faceIndex: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.setFace(roomId, cardId, faceIndex, intentId));
    },
    setFaceDown: (cardIds: string[], faceDown: boolean) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.setFaceDown(roomId, cardIds, faceDown, intentId));
    },
    revealCards: (cardIds: string[], revealed: boolean) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.revealCards(roomId, cardIds, revealed, intentId));
    },
    retry: () => pending.current ? act(pending.current, true) : Promise.resolve(false),
    createToken: (name: string) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.createToken(roomId, name, intentId));
    },
    createCustomToken: (token: CustomToken) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.createCustomToken(roomId, token, intentId));
    },
    copyCard: (cardId: string) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.copyCard(roomId, cardId, intentId));
    },
    counter: (input: CounterAction) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.counter(roomId, input, intentId));
    },
    draw: (count: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.draw(roomId, count, intentId));
    },
    move: (ids: string[], to: string, placement?: 'top' | 'bottom') => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.move(roomId, ids, to, intentId, placement));
    },
    position: (ids: string[], x: number, row: number) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.position(roomId, ids, x, row, intentId));
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
    revealSelection: (ids: string[]) => {
      const intentId = crypto.randomUUID();
      return act(() => roomsApi.revealSelection(roomId, ids, intentId));
    },
  };
}
