import { useEffect, useState } from 'react';
import type { useDecks } from '../decks/useDecks';
import { LiveRoomProvider } from '../live/LiveRoom';
import { MatchBoard } from './MatchBoard';
import { useRooms } from './useRooms';
import { roomsApi } from './roomsApi';
import { RoomPreparation } from './RoomPreparation';
import { PreparationDice } from './PreparationDice';

type Props = { roomId: number; userId: number; decks: ReturnType<typeof useDecks> };

export function RoomScreen({ roomId, userId, decks }: Props) {
  const rooms = useRooms();
  const [deckId, setDeckId] = useState('');
  const room = rooms.rooms.find(value => value.id === roomId);
  const participant = room?.participants.find(value => value.id === userId);
  useEffect(() => {
    if (participant?.deckId) setDeckId(String(participant.deckId));
  }, [participant?.deckId]);
  if (rooms.loading) return <p role="status">{rooms.connection}</p>;
  if (!room) return <MissingRoom roomId={roomId} />;
  if (!participant) return <section aria-label="Entrada na sala">
    <h2>{room.title}</h2>
    <p>{room.status === 'started' ? 'Esta partida já começou. Apenas os participantes podem entrar.' : 'Entre na sala para preparar seu deck.'}</p>
    {room.status === 'preparing' && <button disabled={rooms.busy || room.vacancies === 0} onClick={() => void rooms.join(roomId)}>Entrar na sala</button>}
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
  </section>;
  return <LiveRoomProvider key={roomId} roomId={roomId}>
    <PreparationDice room={room} userId={userId} decks={decks} preparation={<RoomPreparation room={room} participant={participant} userId={userId} deckId={deckId} setDeckId={setDeckId} decks={decks} rooms={rooms} />} match={<MatchBoard roomId={roomId} />} />
  </LiveRoomProvider>;
}

function MissingRoom({ roomId }: { roomId: number }) {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    setChecking(true);
    void roomsApi.match(roomId).then(match => {
      if (active && match.finished) window.location.hash = '/salas';
    }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [roomId]);
  return <p role={checking ? 'status' : 'alert'}>{checking ? 'Verificando sala…' : 'Sala não encontrada.'}</p>;
}
