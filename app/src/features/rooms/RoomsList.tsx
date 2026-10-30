import { useState } from 'react';
import type { Deck } from '../decks/deckApi';
import { CreateRoomPanel } from './CreateRoomPanel';
import { LobbyRoomCard } from './LobbyRoomCard';
import { LobbyToolbar } from './LobbyToolbar';
import { hasActiveFilters, lobbyGroups, noFilters } from './lobbyFilters';
import type { RoomDraft } from './roomsApi';
import { useRooms } from './useRooms';
import './rooms.css';
import './lobby.css';

const openRoom = (id: number) => { window.location.hash = `/salas/${id}`; };

export function RoomsList({ userId, decks }: { userId: number; decks: Deck[] }) {
  const rooms = useRooms();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState(noFilters);
  const groups = lobbyGroups(rooms.rooms, filters);
  const live = rooms.connection === 'Salas atualizadas em tempo real.';
  async function enter(id: number) {
    if (await rooms.join(id)) openRoom(id);
  }
  async function create(draft: RoomDraft) {
    const room = await rooms.create(draft);
    if (room) openRoom(room.id);
  }
  return <section className="rooms" aria-labelledby="rooms-title">
    <div className="rooms-heading">
      <div className="rooms-title">
        <h2 id="rooms-title">Salas</h2>
        <p className={`room-connection${live ? ' room-connection-live' : ''}`} role="status"><i aria-hidden="true" />{rooms.connection}</p>
      </div>
      <button type="button" className="rooms-create" onClick={() => setCreating(true)} disabled={rooms.busy || rooms.loading}><span aria-hidden="true">+</span>Criar sala</button>
    </div>
    {creating && <CreateRoomPanel decks={decks} busy={rooms.busy} error={rooms.error} onCreate={create} onClose={() => setCreating(false)} />}
    {rooms.error && !creating && <p role="alert" className="error">{rooms.error}</p>}
    {rooms.loading && <p className="loading-state" role="status">Carregando mesas…</p>}
    {!rooms.loading && rooms.rooms.length === 0 && <div className="empty-rooms"><span aria-hidden="true">✦</span><h3>A próxima mesa pode ser sua.</h3><p>Nenhuma sala por aqui. Crie uma para reunir seus amigos.</p></div>}
    {rooms.rooms.length > 0 && <LobbyToolbar rooms={rooms.rooms} filters={filters} onChange={setFilters} />}
    {rooms.rooms.length > 0 && groups.length === 0 && <div className="empty-rooms empty-rooms-filtered"><h3>Nenhuma mesa com esses filtros.</h3>{hasActiveFilters(filters) && <button type="button" className="secondary" onClick={() => setFilters(noFilters)}>Limpar filtros</button>}</div>}
    {groups.map(group => <section className="lobby-room-group" key={group.title} aria-label={group.title}>
      <div className="lobby-group-heading"><h4>{group.title}</h4><span>{group.rooms.length}</span></div>
      <div className="room-list">{group.rooms.map(room => <LobbyRoomCard key={room.id} room={room} userId={userId} busy={rooms.busy} onEnter={id => void enter(id)} />)}</div>
    </section>)}
  </section>;
}
