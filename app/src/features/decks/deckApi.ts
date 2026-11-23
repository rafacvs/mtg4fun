export type DeckCard = {
  name: string;
  quantity: number;
  text: string;
  colors?: string;
  type: string;
  mainType: string;
  cmc: number;
  colorIdentity?: string;
  token: boolean;
  available: boolean;
};

export type CatalogCard = Omit<DeckCard, 'quantity' | 'available'>;
export type CatalogPage = { cards: CatalogCard[]; total: number; offset: number; limit: number; hasMore: boolean };

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
	draft: async (): Promise<Deck> => (await request('/api/decks/draft', { method: 'POST' })).deck,
	update: async (id: number, name: string, commander: string, cards: { name: string; quantity: number }[]): Promise<Deck> => (await request(`/api/decks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, commander, cards }) })).deck,
  catalog: async (filters: { q?: string; type?: string; color?: string; cmc?: string; offset: number; limit: number }, signal: AbortSignal): Promise<CatalogPage> => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== undefined) params.set(key, String(value));
    return await request(`/api/decks/catalog?${params.toString()}`, { signal });
  },
  remove: async (id: number): Promise<void> => {
    await request(`/api/decks/${id}`, { method: 'DELETE' });
  },
};
