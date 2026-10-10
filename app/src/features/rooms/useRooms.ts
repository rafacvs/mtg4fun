import { useEffect, useState } from 'react';
import { roomsApi, type Room } from './roomsApi';

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [connection, setConnection] = useState('Conectando às salas…');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const events = new EventSource('/api/rooms/events');
    events.addEventListener('rooms', event => {
      setRooms(JSON.parse((event as MessageEvent<string>).data).rooms);
      setLoading(false);
      setConnection('Salas atualizadas em tempo real.');
    });
    events.addEventListener('session-expired', () => {
      events.close();
      setConnection('Sua sessão terminou. Saia e entre novamente para continuar.');
      setLoading(false);
    });
    events.addEventListener('sync-error', () => {
      setConnection('Não foi possível atualizar as salas. Reconectando…');
    });
    events.onerror = () => setConnection('Conexão interrompida. Reconectando…');
    return () => events.close();
  }, []);

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
  };
}
