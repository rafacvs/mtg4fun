import type { Match } from './roomsApi';

export function findCard(match: Match, id: string) {
  for (const player of match.players) {
    for (const card of [...player.hand ?? [], ...player.battlefield ?? [], ...player.graveyard ?? [], ...player.exile ?? [], ...player.command ?? [], ...player.consulted ?? [], ...player.revealed ?? [], ...player.exposedCards ?? []]) {
      if (card.id === id) return card;
    }
  }
  return null;
}
