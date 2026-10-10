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
    return () => { active = false; };
  }, [roomId]);

  return { match, error };
}
