import { useState } from 'react';
import type { Deck } from '../decks/deckApi';
import { CreateRoomPanel } from './CreateRoomPanel';
import { LobbyRoomCard } from './LobbyRoomCard';
import { useRooms } from './useRooms';
import './rooms.css';

export function RoomsList({ userId, decks }: { userId: number; decks: Deck[] }) {
  const rooms = useRooms();
  const [creating, setCreating] = useState(false);
  const participates = (room: (typeof rooms.rooms)[number]) => room.participants.some(participant => participant.id === userId);
  const groups = [
    { title: 'Minhas mesas', rooms: rooms.rooms.filter(participates) },
    { title: 'Mesas abertas', rooms: rooms.rooms.filter(room => !participates(room) && room.status === 'preparing') },
    { title: 'Em jogo', rooms: rooms.rooms.filter(room => !participates(room) && room.status !== 'preparing') },
  ];
  async function enter(id: number) {
    if (await rooms.join(id)) window.location.hash = `/salas/${id}`;
  }
  return <section className="rooms" aria-labelledby="rooms-title">
    <div className="rooms-heading">
      <div><p className="eyebrow">ENTRE AMIGOS</p><h2 id="rooms-title">Salas</h2><p className="room-connection" role="status">{rooms.connection}</p></div>
      <button onClick={() => setCreating(true)} disabled={rooms.busy || rooms.loading}>Criar sala</button>
    </div>
    {creating && <CreateRoomPanel decks={decks} busy={rooms.busy} error={rooms.error} onCreate={rooms.create} onClose={() => setCreating(false)} />}
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
    {rooms.loading && <p className="loading-state" role="status">Carregando mesas…</p>}
    {!rooms.loading && rooms.rooms.length === 0 && <div className="empty-rooms"><span aria-hidden="true">♧</span><h3>A próxima mesa pode ser sua.</h3><p>Nenhuma sala por aqui. Crie uma para reunir seus amigos.</p></div>}
    {groups.filter(group => group.rooms.length > 0).map(group => <section className="lobby-room-group" key={group.title} aria-label={group.title}>
      <div className="lobby-group-heading"><h4>{group.title}</h4><span>{group.rooms.length} {group.rooms.length === 1 ? 'mesa' : 'mesas'}</span></div>
      <div className="room-list">{group.rooms.map(room => <LobbyRoomCard key={room.id} room={room} userId={userId} busy={rooms.busy} onEnter={id => void enter(id)} />)}</div>
    </section>)}
  </section>;
}
