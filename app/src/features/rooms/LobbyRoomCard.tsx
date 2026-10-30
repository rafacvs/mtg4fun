import type { Room } from './roomsApi';

const mats = ['forest', 'sea', 'mountain', 'swamp'];

function pendingStep(room: Room, userId: number) {
  const me = room.participants.find(participant => participant.id === userId);
  if (!me || me.ready || room.status !== 'preparing') return '';
  return me.deckId ? 'Falta você confirmar' : 'Falta seu deck';
}

function RoomSeats({ room, userId }: { room: Room; userId: number }) {
  const preparing = room.status === 'preparing';
  const empty = preparing ? Math.max(room.seats - room.participants.length, 0) : 0;
  return <ul className="lobby-seats" aria-label={`Participantes da ${room.title}`}>
    {room.participants.map((participant, index) => {
      const creator = participant.id === room.creatorId;
      const ready = preparing && participant.ready;
      return <li key={participant.id} className={participant.id === userId ? 'lobby-seat-me' : undefined} title={[participant.name, creator && 'Criador', ready && 'Pronto'].filter(Boolean).join(' · ')}>
        <span className={`lobby-seat lobby-seat-${index}`} aria-hidden="true">
          {participant.name.slice(0, 1).toUpperCase()}
          {creator && <svg className="lobby-crown" viewBox="0 0 16 12"><path d="M1 11 0 3l4.5 3L8 0l3.5 6L16 3l-1 8Z" /></svg>}
          {ready && <svg className="lobby-ready" viewBox="0 0 12 12"><path d="m2.5 6.5 2.5 2.5 4.5-5.5" /></svg>}
        </span>
        <span className="lobby-participant">{participant.name}</span>
        {creator && <span className="lobby-sr"> · Criador</span>}
        {ready && <span className="lobby-sr"> · Pronto</span>}
      </li>;
    })}
    {Array.from({ length: empty }, (_, index) => <li key={`vaga-${index}`} className="lobby-seat-empty" aria-hidden="true"><span className="lobby-seat" /></li>)}
  </ul>;
}

export function LobbyRoomCard({ room, userId, busy, onEnter }: {
  room: Room; userId: number; busy: boolean; onEnter: (id: number) => void;
}) {
  const participates = room.participants.some(participant => participant.id === userId);
  const preparing = room.status === 'preparing';
  const readyCount = room.participants.filter(participant => participant.ready).length;
  const pending = participates ? pendingStep(room, userId) : '';
  const details = [room.format, `${room.life} de vida`].filter(Boolean).join(' · ');
  return <article className={`room-card ${preparing ? 'room-preparing' : 'room-started'}`} data-mat={mats[room.id % mats.length]} aria-labelledby={`room-${room.id}`}>
    <div className="room-identity">
      <h3 id={`room-${room.id}`} title={room.title}>{room.title}</h3>
      <p className="room-details">{details}{pending && <strong className="room-pending">{pending}</strong>}</p>
    </div>
    <RoomSeats room={room} userId={userId} />
    <div className="room-state">
      <p className="room-status"><i aria-hidden="true" />{preparing ? 'Em preparação' : 'Em andamento'}</p>
      {preparing ? <p className="room-occupancy">
        <span className={room.vacancies === 0 ? undefined : 'room-vacancies'}>{room.vacancies === 0 ? 'Sala cheia' : `${room.vacancies} ${room.vacancies === 1 ? 'vaga' : 'vagas'}`}</span> · {readyCount}/{room.participants.length} prontos
      </p> : <p className="room-occupancy">{room.participants.length} {room.participants.length === 1 ? 'jogador' : 'jogadores'}</p>}
    </div>
    <div className="room-action">
      {participates
        ? <a className="room-enter" href={`/#/salas/${room.id}`}>{preparing ? 'Entrar na mesa' : 'Voltar à partida'}</a>
        : preparing
          ? <button type="button" className="room-join" disabled={busy || room.vacancies === 0} onClick={() => onEnter(room.id)}>Entrar na sala</button>
          : <span className="room-closed">Partida fechada</span>}
    </div>
  </article>;
}
