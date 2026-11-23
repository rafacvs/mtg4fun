import { useEffect, useState } from 'react';
import { deckApi, type CatalogPage } from './deckApi';

export function useDeckCatalogSearch(open: boolean, filters: { q: string; type: string; color: string; cmc: string }, offset: number) {
  const [page, setPage] = useState<CatalogPage>({ cards: [], total: 0, offset: 0, limit: 50, hasMore: false });
  const key = JSON.stringify([filters.q, filters.type, filters.color, filters.cmc, offset]);
  const [pageKey, setPageKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setPage({ cards: [], total: 0, offset, limit: 50, hasMore: false });
    const timer = window.setTimeout(() => {
      deckApi.catalog({ ...filters, offset, limit: 50 }, controller.signal).then(result => { if (!controller.signal.aborted) { setPage(result); setPageKey(key); } }).catch(reason => {
        if (!controller.signal.aborted) { setPageKey(key); setError(reason instanceof Error ? reason.message : 'Falha ao buscar no catálogo.'); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, filters.q, filters.type, filters.color, filters.cmc, offset]);
  const pending = loading || pageKey !== key;
  return { ...page, cards: pending ? [] : page.cards, error, loading: pending };
}
