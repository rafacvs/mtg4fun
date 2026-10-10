export type DeckCard = {
  name: string;
  quantity: number;
  text: string;
  token: boolean;
  available: boolean;
};

export type Deck = { id: number; name: string; cards: DeckCard[] };

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar seus decks.');
  return data;
}

export const deckApi = {
  list: async (): Promise<Deck[]> => (await request('/api/decks')).decks,
  upload: async (file: File): Promise<Deck> => {
    const body = new FormData();
    body.append('file', file);
    return (await request('/api/decks', { method: 'POST', body })).deck;
  },
  remove: async (id: number): Promise<void> => {
    await request(`/api/decks/${id}`, { method: 'DELETE' });
  },
};
