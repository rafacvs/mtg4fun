import { useRooms } from './useRooms';
import './rooms.css';

export function RoomsList({ userId }: { userId: number }) {
  const rooms = useRooms();
  async function enter(id: number) {
    if (await rooms.join(id)) window.location.hash = `/salas/${id}`;
  }
  return <section className="rooms" aria-labelledby="rooms-title">
    <div className="rooms-heading">
      <div><p className="eyebrow">MESAS DISPONÍVEIS</p><h2 id="rooms-title">Salas</h2><p className="room-connection" role="status">{rooms.connection}</p></div>
      <button onClick={() => void rooms.create()} disabled={rooms.busy || rooms.loading}>Criar sala</button>
    </div>
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
    {!rooms.loading && rooms.rooms.length === 0 && <p>Nenhuma sala por aqui. Crie uma para reunir seus amigos.</p>}
    <div className="room-list">{rooms.rooms.map(room => {
      const participates = room.participants.some(participant => participant.id === userId);
      return <article key={room.id} className="room-card" aria-labelledby={`room-${room.id}`}>
        <h3 id={`room-${room.id}`}>{room.title}</h3>
        <p className="room-status">{room.status === 'preparing' ? 'Em preparação' : 'Partida iniciada'}</p>
        <p className="room-vacancies">{room.vacancies === 0 ? 'Sala cheia' : `${room.vacancies} ${room.vacancies === 1 ? 'vaga disponível' : 'vagas disponíveis'}`}</p>
        <ul aria-label={`Participantes da ${room.title}`}>{room.participants.map(participant => <li key={participant.id}>
          {participant.name}{participant.id === room.creatorId && <span> · Criador</span>}{participant.ready && <span> · Pronto</span>}
        </li>)}</ul>
        {participates ? <><p className="room-member">Você participa desta sala.</p><a className="room-enter" href={`/#/salas/${room.id}`}>Entrar na mesa</a></> :
          <button className="secondary" disabled={rooms.busy || room.vacancies === 0 || room.status !== 'preparing'} onClick={() => void enter(room.id)}>Entrar na sala</button>}
      </article>;
    })}</div>
  </section>;
}
