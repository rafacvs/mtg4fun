import { useEffect, useState } from 'react';
import { fetchLeaderboard, type Leaderboard, type Period } from './leaderboardApi';

export function useLeaderboard() {
  const [period, setPeriod] = useState<Period>('all');
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    void fetchLeaderboard(period, controller.signal).then(setData).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o placar.');
    });
    return () => controller.abort();
  }, [period, revision]);
  return { period, setPeriod, data, error, reload: () => setRevision(value => value + 1) };
}
