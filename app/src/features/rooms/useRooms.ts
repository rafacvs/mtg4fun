import { useEffect, useState } from 'react';
import { roomsApi, type Room } from './roomsApi';

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [connection, setConnection] = useState('Conectando às salas…');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => roomsApi.subscribe({
    onRooms: updated => {
      setRooms(updated);
      setLoading(false);
      setConnection('Salas atualizadas em tempo real.');
    },
    onSessionExpired: () => {
      setConnection('Sua sessão terminou. Saia e entre novamente para continuar.');
      setLoading(false);
    },
    onSyncError: () => setConnection('Não foi possível atualizar as salas. Reconectando…'),
    onDisconnected: () => setConnection('Conexão interrompida. Reconectando…'),
  }), []);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); return true; }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'); return false; }
    finally { setBusy(false); }
  }

  return {
    rooms, connection, loading, busy, error,
    settings: (id: number, settings: Parameters<typeof roomsApi.settings>[1]) => act(async () => {
      const updated = await roomsApi.settings(id, settings);
      setRooms(current => current.map(room => room.id === id ? updated : room));
    }),
    create: async (room: Parameters<typeof roomsApi.create>[0]) => {
      let created: Room | undefined;
      await act(async () => { created = await roomsApi.create(room); });
      return created;
    },
    join: (id: number) => act(() => roomsApi.join(id)),
    selectDeck: (id: number, deckId: number) => act(() => roomsApi.selectDeck(id, deckId)),
    setMulliganMode: (id: number, mode: 'standard' | 'aconchegaz') => act(() => roomsApi.setMulliganMode(id, mode)),
    ready: (id: number) => act(() => roomsApi.ready(id)),
    unready: (id: number) => act(() => roomsApi.unready(id)),
    start: (id: number) => act(() => roomsApi.start(id)),
  };
}
