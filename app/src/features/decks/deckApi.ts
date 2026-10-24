export type DeckCard = {
  name: string;
  quantity: number;
  text: string;
  token: boolean;
  available: boolean;
};

export type DeckGroups = {
  commander: DeckCard[];
  creatures: DeckCard[];
  spells: DeckCard[];
  artifacts: DeckCard[];
  lands: DeckCard[];
  other: DeckCard[];
};

export type CurveBin = { cmc: number; count: number };

export type Deck = {
  id: number;
  name: string;
  commander?: string;
  colorIdentity?: string;
  curve: CurveBin[];
  groups: DeckGroups;
  cards: DeckCard[];
};

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar seus decks.');
  return data;
}

export const deckApi = {
	imageURL: (name: string): string => `/api/cards/image?name=${encodeURIComponent(name)}`,
  list: async (): Promise<Deck[]> => (await request('/api/decks')).decks,
  upload: async (file: File): Promise<Deck> => {
    const body = new FormData();
    body.append('file', file);
    return (await request('/api/decks', { method: 'POST', body })).deck;
  },
  setCommander: async (id: number, name: string): Promise<Deck> => {
    return (await request(`/api/decks/${id}/commander`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })).deck;
  },
  remove: async (id: number): Promise<void> => {
    await request(`/api/decks/${id}`, { method: 'DELETE' });
  },
};
