import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lobbyGroups, noFilters, statusCounts } from './lobbyFilters.ts';
import type { Room } from './roomsApi.ts';

const room = (id: number, status: string, participantIds: number[], extra: Partial<Room> = {}): Room => ({
  id, title: `Mesa ${id}`, seats: 4, life: 40, commanderToCommand: true, drawOpeningHand: true, mulliganMode: 'standard', creatorId: 1, status,
  participants: participantIds.map(participant => ({ id: participant, name: `Jogador ${participant}`, ready: false })),
  vacancies: 4 - participantIds.length, ...extra,
});
const titles = (groups: ReturnType<typeof lobbyGroups>) => groups.map(group => [group.title, group.rooms.map(item => item.id)]);

test('separa mesas livres das em andamento, sem considerar quem participa, com as mais novas primeiro', () => {
  const rooms = [room(1, 'started', [1]), room(2, 'preparing', [1]), room(3, 'preparing', [2]), room(4, 'preparing', [1]), room(5, 'started', [2])];
  assert.deepEqual(titles(lobbyGroups(rooms, noFilters)), [['Mesas livres', [4, 3, 2]], ['Em andamento', [5, 1]]]);
});

test('não altera a ordem da lista recebida', () => {
  const rooms = [room(1, 'started', [1]), room(2, 'preparing', [1])];
  lobbyGroups(rooms, noFilters);
  assert.deepEqual(rooms.map(item => item.id), [1, 2]);
});

test('filtra por estado e omite grupos vazios', () => {
  const rooms = [room(1, 'started', [1]), room(2, 'preparing', [2])];
  assert.deepEqual(titles(lobbyGroups(rooms, { ...noFilters, status: 'preparing' })), [['Mesas livres', [2]]]);
  assert.deepEqual(titles(lobbyGroups(rooms, { ...noFilters, status: 'started' })), [['Em andamento', [1]]]);
});

test('sala cheia continua entre as livres, e só com vaga a exclui junto das partidas iniciadas', () => {
  const rooms = [room(1, 'preparing', [2]), room(2, 'preparing', [2, 3, 4, 5]), room(3, 'started', [2])];
  assert.deepEqual(titles(lobbyGroups(rooms, noFilters)), [['Mesas livres', [2, 1]], ['Em andamento', [3]]]);
  assert.deepEqual(titles(lobbyGroups(rooms, { ...noFilters, onlyVacant: true })), [['Mesas livres', [1]]]);
});

test('a busca ignora maiúsculas e acentos e alcança título, formato e jogadores', () => {
  const rooms = [room(1, 'preparing', [2], { title: 'Sábado à noite' }), room(2, 'preparing', [2], { format: 'Commander' }), room(3, 'preparing', [7])];
  const found = (query: string) => lobbyGroups(rooms, { ...noFilters, query }).flatMap(group => group.rooms.map(item => item.id));
  assert.deepEqual(found('  SABADO '), [1]);
  assert.deepEqual(found('commander'), [2]);
  assert.deepEqual(found('jogador 7'), [3]);
  assert.deepEqual(found('ninguém'), []);
});

test('as contagens respeitam busca e vaga, mas não a aba escolhida', () => {
  const rooms = [room(1, 'preparing', [2]), room(2, 'started', [2]), room(3, 'preparing', [2], { title: 'Outra' })];
  assert.deepEqual(statusCounts(rooms, { ...noFilters, status: 'started' }), { all: 3, preparing: 2, started: 1 });
  assert.deepEqual(statusCounts(rooms, { ...noFilters, query: 'outra' }), { all: 1, preparing: 1, started: 0 });
});
