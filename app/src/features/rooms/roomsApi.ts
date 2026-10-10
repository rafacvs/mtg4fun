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
  initialLife: number;
  turnOrder: { userId: number; name: string; roll: number }[];
  currentTurn: { userId: number; name: string; roll: number };
  players: { userId: number; name: string; life: number; libraryCount: number; handCount: number; battlefieldCount: number; graveyardCount: number; exileCount: number; commandCount: number }[];
  events: { actor: string; kind: string; result: string }[];
};

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

async function matchAction(id: number, body: unknown): Promise<Match> {
  const response = await fetch(`/api/rooms/${id}/match/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data.match;
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
  roll: (id: number, sides: number) => matchAction(id, { intentId: crypto.randomUUID(), kind: 'roll', sides }),
  coin: (id: number) => matchAction(id, { intentId: crypto.randomUUID(), kind: 'coin' }),
  turn: (id: number, direction: 'next' | 'previous') => matchAction(id, { intentId: crypto.randomUUID(), kind: 'turn', direction }),
};
