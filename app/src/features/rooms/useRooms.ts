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
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  }

  return {
    rooms, connection, loading, busy, error,
    create: () => act(roomsApi.create),
    join: (id: number) => act(() => roomsApi.join(id)),
    ready: (id: number, deckId: number) => act(() => roomsApi.ready(id, deckId)),
    start: (id: number) => act(() => roomsApi.start(id)),
  };
}
