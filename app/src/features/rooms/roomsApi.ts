export type Room = {
  id: number;
  title: string;
  creatorId: number;
  status: string;
  participants: { id: number; name: string; ready: boolean }[];
  vacancies: number;
};

export type MarkerColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';
export type Markers = Partial<Record<MarkerColor, number>>;
export type Match = {
  finished: boolean;
  finishVotes: number[];
  finishRequired: number;
  roomId: number;
  viewerId: number;
  initialLife: number;
  turnOrder: { userId: number; name: string; roll: number }[];
  currentTurn: { userId: number; name: string; roll: number };
  players: { userId: number; name: string; life: number; markers?: Markers; libraryCount: number; handCount: number; battlefieldCount: number; graveyardCount: number; exileCount: number; commandCount: number; hand?: Card[]; battlefield?: Card[]; graveyard?: Card[]; exile?: Card[]; command?: Card[]; consulted?: Card[]; revealed?: Card[]; exposedCards?: Card[]; consultationFrom?: 'top' | 'bottom' | 'all' }[];
  log: { actorId: number; actorName: string; kind: string; from?: string; to?: string; count?: number; result?: string; cards?: { id: string; name: string }[] }[];
};
export type Card = { id: string; name: string; ownerId: number; controllerId: number; zone: string; positionX: number; row: number; stackOrder: number; revealed?: boolean; tapped?: boolean; faceDown?: boolean; faces?: string[]; faceIndex?: number; text?: string; imageName?: string; instanceKind?: string; isToken?: boolean; power?: number; toughness?: number; printedPower?: string; printedToughness?: string; markers?: Markers };
export type CatalogToken = { name: string; text?: string; power?: string; toughness?: string; imageName?: string };
export type CustomToken = { name: string; description: string; power?: string; toughness?: string };

export type CounterAction =
  | { target: 'player'; playerId: number; subject: 'life'; operation: 'set' | 'increment'; value: number }
  | { target: 'player'; playerId: number; subject: 'marker'; color: MarkerColor; operation: 'set' | 'increment'; value: number }
  | { target: 'card'; cardId: string; subject: 'power' | 'toughness'; operation: 'set' | 'increment'; value: number }
  | { target: 'card'; cardId: string; subject: 'marker'; color: MarkerColor; operation: 'set' | 'increment'; value: number };

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
  finish: (id: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'finish' }),
  subscribe,
  setTapped: (id: number, cardIds: string[], tapped: boolean, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'set_tapped', cardIds, tapped }),
  hideAllRevealed: (id: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'hide_all_revealed' }),
  untapAll: (id: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'untap_all' }),
  setFace: (id: number, cardId: string, faceIndex: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'set_face', cardId, faceIndex }),
  setFaceDown: (id: number, cardIds: string[], faceDown: boolean, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'set_face_down', cardIds, faceDown }),
  revealCards: (id: number, cardIds: string[], revealed: boolean, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reveal_cards', cardIds, revealed }),
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
  tokens: async (id: number, query: string): Promise<CatalogToken[]> => {
    const response = await fetch(`/api/rooms/${id}/match/tokens?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar as fichas.');
    return data.tokens;
  },
  createToken: (id: number, tokenName: string, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'create-token', tokenName }),
  createCustomToken: (id: number, token: CustomToken, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'create-custom-token', ...token }),
  copyCard: (id: number, cardId: string, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'copy-card', cardId }),
  counter: (id: number, input: CounterAction, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'counter', ...input }),
  draw: (id: number, count: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'draw', count }),
  move: (id: number, cardIds: string[], to: string, intentId: string, libraryPlacement?: 'top' | 'bottom', at?: { x: number; row: number }) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'move', cardIds, to, ...(libraryPlacement ? { libraryPlacement } : {}), ...(at ? { x: at.x, row: at.row } : {}) }),
  transferControl: (id: number, cardId: string, controllerId: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'transfer_control', cardId, controllerId }),
  position: (id: number, cardIds: string[], x: number, row: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'position', ...(cardIds.length === 1 ? { cardId: cardIds[0] } : { cardIds }), x, row }),
  roll: (id: number, sides: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'roll', sides }),
  coin: (id: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'coin' }),
  turn: (id: number, direction: 'next' | 'previous', intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'turn', direction }),
  consult: (id: number, consultFrom: 'all' | 'top' | 'bottom', count: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'consult', consultFrom, count }),
  reorder: (id: number, cardIds: string[], intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reorder', cardIds }),
  closeConsultation: (id: number, placement: 'top' | 'bottom', shuffle: boolean, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: shuffle ? 'shuffle' : 'close', libraryPlacement: placement }),
  reveal: (id: number, count: number, intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reveal', count }),
  revealSelection: (id: number, cardIds: string[], intentId: string) => matchChange(`/api/rooms/${id}/match/actions`, { intentId, kind: 'reveal', cardIds }),
};
