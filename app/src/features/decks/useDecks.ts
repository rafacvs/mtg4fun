import { useEffect, useState } from 'react';
import { deckApi, type Deck } from './deckApi';

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    deckApi.list()
      .then(data => {
        if (active) setDecks(data);
      })
      .catch(reason => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function upload(file: File) {
    if (loading || busy) return false;
    setBusy(true);
    setError('');
    try {
      const deck = await deckApi.upload(file);
      setDecks(current => [deck, ...current]);
      setSelected(deck.id);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível importar o deck.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError('');
    try {
      await deckApi.remove(id);
      setDecks(current => current.filter(deck => deck.id !== id));
      setSelected(current => current === id ? null : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o deck.');
    } finally {
      setBusy(false);
    }
  }

  return { decks, loading, busy, error, selected, setSelected, upload, remove };
}
