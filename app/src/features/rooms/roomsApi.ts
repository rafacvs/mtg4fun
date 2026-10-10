export type Room = {
  id: number;
  title: string;
  creatorId: number;
  status: string;
  participants: { id: number; name: string; ready: boolean }[];
  vacancies: number;
};

export type Match = {
  roomId: number;
  viewerId: number;
  initialLife: number;
  turnOrder: { userId: number; name: string; roll: number }[];
  players: { userId: number; name: string; life: number; libraryCount: number; handCount: number; battlefieldCount: number; graveyardCount: number; exileCount: number; commandCount: number; hand?: Card[]; battlefield?: Card[]; graveyard?: Card[]; exile?: Card[]; command?: Card[] }[];
  log: { actorName: string; kind: string; from?: string; to?: string; count?: number }[];
};
export type Card = { id: string; name: string; ownerId: number; controllerId: number; zone: string };

async function change(path: string, method = 'POST', body: unknown = {}): Promise<void> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  }
}

class MatchActionResponseError extends Error {}
async function matchChange(path: string, body: unknown): Promise<Match> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new MatchActionResponseError(data.error || 'Não foi possível concluir. Tente novamente.');
      return data.match;
    } catch (reason) {
      if (attempt === 1 || reason instanceof MatchActionResponseError) throw reason;
    }
  }
  throw new Error('Não foi possível concluir. Tente novamente.');
}

type Updates = {
  onRooms: (rooms: Room[]) => void;
  onDisconnected: () => void;
  onSessionExpired: () => void;
  onSyncError: () => void;
};

function subscribe(updates: Updates): () => void {
  const events = new EventSource('/api/rooms/events');
  events.addEventListener('rooms', event => {
    updates.onRooms(JSON.parse((event as MessageEvent<string>).data).rooms);
  });
  events.addEventListener('session-expired', () => {
    events.close();
    updates.onSessionExpired();
  });
  events.addEventListener('sync-error', updates.onSyncError);
  events.onerror = updates.onDisconnected;
  return () => events.close();
}

export const roomsApi = {
  subscribe,
  create: () => change('/api/rooms'),
  join: (id: number) => change(`/api/rooms/${id}/participants`),
  ready: (id: number, deckId: number) => change(`/api/rooms/${id}/participants/me/ready`, 'PUT', { deckId }),
  start: (id: number) => change(`/api/rooms/${id}/start`),
  match: async (id: number): Promise<Match> => {
    const response = await fetch(`/api/rooms/${id}/match`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a partida.');
    return data.match;
  },
  draw: (id: number, count: number) => matchChange(`/api/rooms/${id}/match/actions`, { intentId: crypto.randomUUID(), kind: 'draw', count }),
  move: (id: number, cardIds: string[], to: string, libraryPlacement?: 'top' | 'bottom') => matchChange(`/api/rooms/${id}/match/actions`, { intentId: crypto.randomUUID(), kind: 'move', cardIds, to, ...(libraryPlacement ? { libraryPlacement } : {}) }),
};
