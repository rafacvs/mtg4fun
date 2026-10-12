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
  currentTurn: { userId: number; name: string; roll: number };
  players: { userId: number; name: string; life: number; counters?: Record<string, number>; counterNames?: string[]; libraryCount: number; handCount: number; battlefieldCount: number; graveyardCount: number; exileCount: number; commandCount: number; hand?: Card[]; battlefield?: Card[]; graveyard?: Card[]; exile?: Card[]; command?: Card[]; consulted?: Card[]; revealed?: Card[]; consultationFrom?: 'top' | 'bottom' | 'all' }[];
  log: { actorId: number; actorName: string; kind: string; from?: string; to?: string; count?: number; result?: string }[];
};
export type Card = { id: string; name: string; ownerId: number; controllerId: number; zone: string; positionX: number; row: number; stackOrder: number; revealed?: boolean; counters?: Record<string, number> };

export type CounterAction = { target: 'player'; playerId: number; name: string; operation: 'set' | 'increment'; value: number } | { target: 'card'; cardId: string; name: string; operation: 'set' | 'increment'; value: number };

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
export class UnconfirmedActionError extends Error {}
async function matchChange(path: string, body: unknown): Promise<Match> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new MatchActionResponseError(data.error || 'Não foi possível concluir. Tente novamente.');
      return data.match;
    } catch (reason) {
      if (reason instanceof MatchActionResponseError) throw reason;
      if (attempt === 1) throw new UnconfirmedActionError('Não foi possível confirmar a ação. Tente novamente para recuperar a confirmação.');
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
  counter: (id: number, input: CounterAction, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'counter', ...input }),
  draw: (id: number, count: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'draw', count }),
  move: (id: number, cardIds: string[], to: string, intentId: string, libraryPlacement?: 'top' | 'bottom') => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'move', cardIds, to, ...(libraryPlacement ? { libraryPlacement } : {}) }),
  position: (id: number, cardId: string, x: number, row: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'position', cardId, x, row }),
  roll: (id: number, sides: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'roll', sides }),
  coin: (id: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'coin' }),
  turn: (id: number, direction: 'next' | 'previous', intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'turn', direction }),
  consult: (id: number, consultFrom: 'all' | 'top' | 'bottom', count: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'consult', consultFrom, count }),
  reorder: (id: number, cardIds: string[], intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reorder', cardIds }),
  closeConsultation: (id: number, placement: 'top' | 'bottom', shuffle: boolean, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: shuffle ? 'shuffle' : 'close', libraryPlacement: placement }),
  reveal: (id: number, count: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reveal', count }),
  revealSelection: (id: number, cardIds: string[], intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reveal', cardIds }),
};
