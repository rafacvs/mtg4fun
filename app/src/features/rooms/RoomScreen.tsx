import { useEffect, useRef, useState } from 'react';
import type { useDecks } from '../decks/useDecks';
import { LiveRoomProvider } from '../live/LiveRoom';
import { MatchBoard } from './MatchBoard';
import { useRooms } from './useRooms';
import { roomsApi } from './roomsApi';
import { RoomPreparation } from './RoomPreparation';
import { PreparationDice } from './PreparationDice';
import { SpectatorBoard } from './SpectatorBoard';

type Props = { roomId: number; userId: number; decks: ReturnType<typeof useDecks> };

export function RoomScreen({ roomId, userId, decks }: Props) {
  const rooms = useRooms();
  const [deckId, setDeckId] = useState('');
  const watched = useRef(false);
  const room = rooms.rooms.find(value => value.id === roomId);
  const participant = room?.participants.find(value => value.id === userId);
  useEffect(() => {
    if (participant?.deckId) setDeckId(String(participant.deckId));
  }, [participant?.deckId]);
  if (rooms.loading) return <p role="status">{rooms.connection}</p>;
  if (!room) return <MissingRoom roomId={roomId} watched={watched.current} />;
  if (!participant) {
    if (room.status === 'started') { watched.current = true; return <LiveRoomProvider key={roomId} roomId={roomId}><SpectatorBoard roomId={roomId} /></LiveRoomProvider>; }
    if (room.status === 'determining_order') return <p role="status">Os jogadores estão definindo a ordem dos turnos. A mesa abre em seguida.</p>;
    return <section aria-label="Entrada na sala">
      <h2>{room.title}</h2>
      <p>Entre na sala para preparar seu deck.</p>
      <button disabled={rooms.busy || room.vacancies === 0} onClick={() => void rooms.join(roomId)}>Entrar na sala</button>
      {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
    </section>;
  }
  return <LiveRoomProvider key={roomId} roomId={roomId}>
    <PreparationDice room={room} userId={userId} decks={decks} preparation={<RoomPreparation room={room} participant={participant} userId={userId} deckId={deckId} setDeckId={setDeckId} decks={decks} rooms={rooms} />} match={<MatchBoard roomId={roomId} />} />
  </LiveRoomProvider>;
}

// The room leaves the list when the match ends, which sends whoever was watching back to the lobby.
function MissingRoom({ roomId, watched }: { roomId: number; watched: boolean }) {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (watched) { window.location.hash = '/salas'; return; }
    let active = true;
    setChecking(true);
    void roomsApi.match(roomId).then(match => {
      if (active && match.finished) window.location.hash = '/salas';
    }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [roomId]);
  return <p role={checking ? 'status' : 'alert'}>{checking ? 'Verificando sala…' : 'Sala não encontrada.'}</p>;
}
