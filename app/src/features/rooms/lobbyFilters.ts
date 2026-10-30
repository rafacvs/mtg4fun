import type { Room } from './roomsApi';

export type StatusFilter = 'all' | 'preparing' | 'started';
export type LobbyFilters = { status: StatusFilter; query: string; onlyVacant: boolean };

export const noFilters: LobbyFilters = { status: 'all', query: '', onlyVacant: false };

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const isPreparing = (room: Room) => room.status === 'preparing';

function matchesQuery(room: Room, query: string) {
  const wanted = normalize(query);
  if (!wanted) return true;
  return [room.title, room.format ?? '', ...room.participants.map(participant => participant.name)].some(text => normalize(text).includes(wanted));
}

function matches(room: Room, filters: LobbyFilters) {
  if (filters.onlyVacant && !(isPreparing(room) && room.vacancies > 0)) return false;
  return matchesQuery(room, filters.query);
}

// As contagens das abas ignoram a própria aba: mostram o que há para abrir nos demais filtros.
export function statusCounts(rooms: Room[], filters: LobbyFilters): Record<StatusFilter, number> {
  const visible = rooms.filter(room => matches(room, filters));
  const preparing = visible.filter(isPreparing).length;
  return { all: visible.length, preparing, started: visible.length - preparing };
}

export function hasActiveFilters(filters: LobbyFilters) {
  return filters.status !== 'all' || filters.onlyVacant || filters.query.trim() !== '';
}

export function lobbyGroups(rooms: Room[], filters: LobbyFilters) {
  const visible = rooms
    .filter(room => matches(room, filters))
    .filter(room => filters.status === 'all' || (filters.status === 'preparing') === isPreparing(room))
    .sort((a, b) => b.id - a.id);
  return [
    { title: 'Mesas livres', rooms: visible.filter(isPreparing) },
    { title: 'Em andamento', rooms: visible.filter(room => !isPreparing(room)) },
  ].filter(group => group.rooms.length > 0);
}
