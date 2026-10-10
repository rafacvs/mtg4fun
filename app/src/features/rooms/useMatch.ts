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

  async function act(action: () => Promise<Match>) {
    setError('');
    try { setMatch(await action()); } catch (reason) { setError((reason as Error).message); }
  }
  return { match, error, roll: (sides: number) => act(() => roomsApi.roll(roomId, sides)), coin: () => act(() => roomsApi.coin(roomId)), turn: (direction: 'next' | 'previous') => act(() => roomsApi.turn(roomId, direction)) };
}
