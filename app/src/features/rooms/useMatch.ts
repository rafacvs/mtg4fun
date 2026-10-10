import { useEffect, useState } from 'react';
import { roomsApi, type Match } from './roomsApi';

export function useMatch(roomId: number) {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    roomsApi.match(roomId)
      .then(value => { if (active) setMatch(value); })
      .catch(reason => { if (active) setError(reason.message); });
    const polling = window.setInterval(() => {
      roomsApi.match(roomId).then(value => { if (active) setMatch(value); }).catch(reason => { if (active) setError(reason.message); });
    }, 1000);
    return () => { active = false; window.clearInterval(polling); };
  }, [roomId]);

  async function act(operation: () => Promise<Match>) {
    setError('');
    try { setMatch(await operation()); } catch (reason) { setError((reason as Error).message); }
  }
  return { match, error, draw: (count: number) => act(() => roomsApi.draw(roomId, count)), move: (ids: string[], to: string, placement?: 'top' | 'bottom') => act(() => roomsApi.move(roomId, ids, to, placement)) };
}
