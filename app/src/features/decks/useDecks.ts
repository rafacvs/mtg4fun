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
        if (active) {
          setDecks(data);
          setSelected(current => current ?? data[0]?.id ?? null);
        }
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
    if (loading || busy) return null;
    setBusy(true);
    setError('');
    try {
      const deck = await deckApi.upload(file);
      setDecks(current => [deck, ...current]);
      setSelected(deck.id);
      return deck;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível importar o deck.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function setCommander(id: number, name: string) {
    if (loading || busy) return false;
    setBusy(true);
    setError('');
    try {
      const deck = await deckApi.setCommander(id, name);
      setDecks(current => current.map(item => item.id === id ? deck : item));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o comandante.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    if (loading || busy) return null;
    setBusy(true); setError('');
    try {
      const deck = await deckApi.draft();
      setDecks(current => [deck, ...current]); setSelected(deck.id); return deck;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o deck.'); return null;
    } finally { setBusy(false); }
  }

  async function update(id: number, name: string, commander: string, cards: { name: string; quantity: number }[]) {
    if (loading || busy) return null;
    setBusy(true); setError('');
    try {
      const deck = await deckApi.update(id, name, commander, cards);
      setDecks(current => current.map(item => item.id === id ? deck : item)); return deck;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar as alterações.'); return null;
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    setBusy(true);
    setError('');
    try {
      await deckApi.remove(id);
      setDecks(current => current.filter(deck => deck.id !== id));
      setSelected(current => current === id ? null : current);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o deck.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { decks, loading, busy, error, selected, setSelected, upload, setCommander, createDraft, update, remove };
}
