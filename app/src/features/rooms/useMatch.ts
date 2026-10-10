import { useEffect, useRef, useState } from 'react';
import { roomsApi, type Match } from './roomsApi';

export function useMatch(roomId: number) {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [busy, setBusy] = useState(false);
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

  async function act(operation: () => Promise<Match>) {
    if (acting.current) return false;
    acting.current = true;
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      const confirmed = await operation();
      if (mounted.current) { setMatch(confirmed); setSyncError(''); }
      return true;
    } catch (reason) {
      if (mounted.current) setError((reason as Error).message);
      return false;
    } finally {
      acting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    match, error: error || syncError, busy,
    draw: (count: number) => act(() => roomsApi.draw(roomId, count)),
    move: (ids: string[], to: string, placement?: 'top' | 'bottom') => act(() => roomsApi.move(roomId, ids, to, placement)),
  };
}
