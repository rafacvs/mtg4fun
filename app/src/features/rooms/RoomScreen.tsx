import { useEffect, useState } from 'react';
import type { useDecks } from '../decks/useDecks';
import { MatchBoard } from './MatchBoard';
import { useRooms } from './useRooms';
import { roomsApi } from './roomsApi';

type Props = { roomId: number; userId: number; decks: ReturnType<typeof useDecks> };

export function RoomScreen({ roomId, userId, decks }: Props) {
  const rooms = useRooms();
  const [deckId, setDeckId] = useState('');
  const room = rooms.rooms.find(value => value.id === roomId);
  if (rooms.loading) return <p role="status">{rooms.connection}</p>;
  if (!room) return <MissingRoom roomId={roomId} />;
  const participant = room.participants.find(value => value.id === userId);
  if (!participant) return <section aria-label="Entrada na sala">
    <h2>{room.title}</h2>
    <p>{room.status === 'started' ? 'Esta partida já começou. Apenas os participantes podem entrar.' : 'Entre na sala para preparar seu deck.'}</p>
    {room.status === 'preparing' && <button disabled={rooms.busy || room.vacancies === 0} onClick={() => void rooms.join(roomId)}>Entrar na sala</button>}
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
  </section>;
  if (room.status === 'started') return <MatchBoard roomId={roomId} />;
  return <section className="room-preparation" aria-label="Preparação da sala">
    <h2>{room.title}</h2>
    <p>Escolha um deck. O criador pode iniciar quando todos estiverem prontos.</p>
    <ul>{room.participants.map(value => <li key={value.id}>{value.name} · {value.ready ? 'Pronto' : 'Escolhendo deck'}</li>)}</ul>
    {decks.error && <p role="alert" className="error">{decks.error}</p>}
    {!decks.loading && decks.decks.length === 0 && <p><a href="/#/decks">Importe um deck</a> e volte a esta sala para confirmar.</p>}
    <label htmlFor="room-deck">Deck para a partida</label>
    <select id="room-deck" value={deckId} disabled={decks.loading || rooms.busy || participant.ready} onChange={event => setDeckId(event.target.value)}>
      <option value="">Selecione um deck</option>
      {decks.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
    </select>
    <button disabled={rooms.busy || participant.ready || !deckId} onClick={() => void rooms.ready(roomId, Number(deckId))}>{participant.ready ? 'Deck confirmado' : 'Confirmar deck'}</button>
    {room.creatorId === userId && <button className="secondary" disabled={rooms.busy} onClick={() => void rooms.start(roomId)}>Iniciar partida</button>}
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
  </section>;
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
