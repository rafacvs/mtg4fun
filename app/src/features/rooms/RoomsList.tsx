import { useEffect, useState } from 'react';
import type { useDecks } from '../decks/useDecks';
import { roomsApi, type Match } from './roomsApi';
import { useRooms } from './useRooms';
import './rooms.css';

type Props = { userId: number; decks: ReturnType<typeof useDecks> };

export function RoomsList({ userId, decks }: Props) {
  const rooms = useRooms();
  return <section className="rooms" aria-labelledby="rooms-title">
    <h2 id="rooms-title">Salas</h2>
    <p className="room-connection" role="status">{rooms.connection}</p>
    <button onClick={() => void rooms.create()} disabled={rooms.busy || rooms.loading}>Criar sala</button>
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
    {!rooms.loading && rooms.rooms.length === 0 && <p>Nenhuma sala por aqui. Crie uma para reunir seus amigos.</p>}
    <div className="room-list">
      {rooms.rooms.map(room => {
        const participates = room.participants.some(participant => participant.id === userId);
        return <article key={room.id} className="room-card" aria-labelledby={`room-${room.id}`}>
          <h3 id={`room-${room.id}`}>{room.title}</h3>
          <p>{room.status === 'preparing' ? 'Em preparação' : 'Partida iniciada'}</p>
          <p className="room-vacancies">{room.vacancies === 0 ? 'Sala cheia' : `${room.vacancies} ${room.vacancies === 1 ? 'vaga disponível' : 'vagas disponíveis'}`}</p>
          <ul aria-label={`Participantes da ${room.title}`}>
            {room.participants.map(participant => <li key={participant.id}>
              {participant.name}{participant.id === room.creatorId && <span> · Criador</span>}
              {participant.ready && <span> · Pronto</span>}
            </li>)}
          </ul>
          {participates && room.status === 'preparing' && <Preparation roomId={room.id} creatorId={room.creatorId} userId={userId} ready={room.participants.find(participant => participant.id === userId)?.ready ?? false} decks={decks.decks} loading={decks.loading} busy={rooms.busy} onReady={rooms.ready} onStart={rooms.start} />}
          {room.status === 'started' && participates && <MatchBoard roomId={room.id} />}
          {participates ? <p className="room-member">Você participa desta sala.</p> : <button
            className="secondary"
            disabled={rooms.busy || room.vacancies === 0 || room.status !== 'preparing'}
            onClick={() => void rooms.join(room.id)}
          >Entrar na sala</button>}
        </article>;
      })}
    </div>
  </section>;
}

type PreparationProps = { roomId: number; creatorId: number; userId: number; ready: boolean; decks: { id: number; name: string }[]; loading: boolean; busy: boolean; onReady: (id: number, deckId: number) => Promise<void>; onStart: (id: number) => Promise<void> };
function Preparation({ roomId, creatorId, userId, ready, decks, loading, busy, onReady, onStart }: PreparationProps) {
  const [deckId, setDeckId] = useState('');
  return <div className="room-preparation">
    <label htmlFor={`room-deck-${roomId}`}>Deck para a partida</label>
    <select id={`room-deck-${roomId}`} value={deckId} disabled={loading || busy || ready} onChange={event => setDeckId(event.target.value)}>
      <option value="">Selecione um deck</option>
      {decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
    </select>
    <button disabled={busy || ready || !deckId} onClick={() => void onReady(roomId, Number(deckId))}>{ready ? 'Deck confirmado' : 'Confirmar deck'}</button>
    {creatorId === userId && <button className="secondary" disabled={busy} onClick={() => void onStart(roomId)}>Iniciar partida</button>}
  </div>;
}

function MatchBoard({ roomId }: { roomId: number }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; roomsApi.match(roomId).then(value => { if (active) setMatch(value); }).catch(reason => { if (active) setError(reason.message); }); return () => { active = false; }; }, [roomId]);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!match) return <p role="status">Carregando mesa…</p>;
  return <section className="match-board" aria-label="Mesa da partida">
    <p>Vida inicial: {match.initialLife}</p>
    <p>Ordem de turno: {match.turnOrder.map(turn => `${turn.name} (D20: ${turn.roll})`).join(', ')}</p>
    <div className="match-players">{match.players.map(player => <article key={player.userId}><h4>{player.name}</h4><p>Vida: {player.life}</p><p>Grimório: {player.libraryCount} cartas · Mão: {player.handCount}</p><p>Campo: {player.battlefieldCount} · Cemitério: {player.graveyardCount} · Exílio: {player.exileCount} · Comando: {player.commandCount}</p></article>)}</div>
  </section>;
}
