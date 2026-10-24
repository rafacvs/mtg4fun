import type { Room } from './roomsApi';

export function LobbyRoomCard({ room, userId, busy, onEnter }: {
  room: Room; userId: number; busy: boolean; onEnter: (id: number) => void;
}) {
  const participates = room.participants.some(participant => participant.id === userId);
  const preparing = room.status === 'preparing';
  return <article className={`room-card ${preparing ? 'room-preparing' : 'room-started'}`} aria-labelledby={`room-${room.id}`}>
    <h3 id={`room-${room.id}`}>{room.title}</h3>
    <p className="room-status">{preparing ? 'Em preparação' : 'Partida iniciada'}</p>
    <p className="room-occupancy">{room.participants.length}{preparing ? `/${room.seats}` : ''} jogadores</p>
    {preparing && <p className="room-vacancies">{room.vacancies === 0 ? 'Sala cheia' : `${room.vacancies} ${room.vacancies === 1 ? 'vaga disponível' : 'vagas disponíveis'}`}</p>}
    <ul aria-label={`Participantes da ${room.title}`}>{room.participants.map((participant, index) => <li key={participant.id}>
      <span className={`lobby-seat lobby-seat-${index}`} aria-hidden="true">{participant.name.slice(0, 1)}</span>
      <span className="lobby-participant">{participant.name}{participant.id === room.creatorId && <small> · Criador</small>}{participant.ready && <small> · Pronto</small>}</span>
    </li>)}</ul>
    {participates ? <><p className="room-member">Você participa desta sala.</p><a className="room-enter" href={`/#/salas/${room.id}`}>Entrar na mesa</a></> : preparing &&
      <button className="secondary" disabled={busy || room.vacancies === 0} onClick={() => onEnter(room.id)}>Entrar na sala</button>}
  </article>;
}
