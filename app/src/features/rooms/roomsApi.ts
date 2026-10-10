export type Room = {
  id: number;
  title: string;
  creatorId: number;
  status: string;
  participants: { id: number; name: string }[];
  vacancies: number;
};

async function change(path: string): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  }
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
};
