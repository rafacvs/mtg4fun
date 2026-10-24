import type { Card, Match } from './roomsApi';
import { firstFreeCell } from './battlefieldLayout';

const zones = ['hand', 'battlefield', 'graveyard', 'exile', 'command'] as const;
const counts = { hand: 'handCount', battlefield: 'battlefieldCount', graveyard: 'graveyardCount', exile: 'exileCount', command: 'commandCount' } as const;

export function optimisticMove(match: Match, ids: string[], destination: string, at?: { x: number; row: number }): Match {
  const selected = new Set(ids);
  const moving = new Map<string, Card>();
  for (const player of match.players) {
    for (const zone of [...zones, 'consulted', 'revealed', 'exposedCards'] as const) {
      for (const card of player[zone] ?? []) {
        if (selected.has(card.id) && card.controllerId === match.viewerId && !moving.has(card.id)) moving.set(card.id, card);
      }
    }
  }
  const cards = [...moving.values()];
  const field = match.players.find(player => player.userId === match.viewerId)?.battlefield?.filter(card => !moving.has(card.id)) ?? [];
  const entering = cards.flatMap(card => {
    const ephemeral = card.isToken || ['token', 'custom-token', 'copy'].includes(card.instanceKind ?? '');
    if (destination === 'library' || ephemeral && destination !== 'battlefield') return [];
    const cell = at ? { column: at.x, row: at.row } : firstFreeCell(field);
    const projected = { ...card, pending: true, zone: destination, controllerId: destination === 'battlefield' ? match.viewerId : card.ownerId,
      ...(destination === 'battlefield' ? { positionX: cell.column, row: cell.row, stackOrder: Math.max(0, ...field.map(item => item.stackOrder)) + 1 } : {}) };
    if (destination === 'battlefield') field.push(projected);
    return [projected];
  });
  const sourcePlayer = (card: Card) => card.zone === 'battlefield' ? card.controllerId : card.ownerId;
  return { ...match, players: match.players.map(player => {
    const next = { ...player };
    for (const zone of zones) {
      const added = entering.filter(card => card.zone === zone && (zone === 'battlefield' ? card.controllerId : card.ownerId) === player.userId);
      const removed = cards.filter(card => card.zone === zone && sourcePlayer(card) === player.userId).length;
      next[counts[zone]] = player[counts[zone]] - removed + added.length;
      if (player[zone] || added.length && !(zone === 'hand' && player.userId !== match.viewerId)) {
        next[zone] = [...(player[zone] ?? []).filter(card => !moving.has(card.id)), ...added];
      }
    }
    const fromLibrary = cards.filter(card => ['library', 'consulted', 'revealed'].includes(card.zone) && card.ownerId === player.userId).length;
    const toLibrary = destination === 'library' ? cards.filter(card => card.ownerId === player.userId && !(card.isToken || ['token', 'custom-token', 'copy'].includes(card.instanceKind ?? ''))).length : 0;
    next.libraryCount = player.libraryCount - fromLibrary + toLibrary;
    for (const zone of ['consulted', 'revealed', 'exposedCards'] as const) if (player[zone]) next[zone] = player[zone]!.filter(card => !moving.has(card.id));
    return next;
  }) };
}

export function optimisticPosition(match: Match, ids: string[], column: number, row: number): Match {
  const selected = new Set(ids);
  const own = match.players.find(player => player.userId === match.viewerId);
  const anchor = own?.battlefield?.find(card => card.id === ids[0]);
  if (!anchor) return match;
  return { ...match, players: match.players.map(player => ({ ...player, battlefield: player.battlefield?.map(card =>
    selected.has(card.id) && card.controllerId === match.viewerId ? { ...card, pending: true, positionX: card.positionX + column - anchor.positionX, row: card.row + row - anchor.row } : card) })) };
}
