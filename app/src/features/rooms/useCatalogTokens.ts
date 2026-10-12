import { useEffect, useState } from 'react';
import { roomsApi, type CatalogToken } from './roomsApi';

export function useCatalogTokens(roomId: number, query: string, enabled: boolean) {
  const [tokens, setTokens] = useState<CatalogToken[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError('');
    const timeout = window.setTimeout(() => {
      void roomsApi.tokens(roomId, query).then(result => {
        if (active) setTokens(result);
      }).catch(reason => {
        if (active) {
          setTokens([]);
          setError((reason as Error).message);
        }
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [enabled, roomId, query]);

  return { tokens, error, loading };
}
