import type { Match } from './roomsApi.ts';

export function elapsedTime(start: string | undefined, end: number) {
  if (!start || !Number.isFinite(Date.parse(start))) return '—';
  const seconds = Math.max(0, Math.floor((end - Date.parse(start)) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export function turnStatistics(entries: Match['log'], playerId: number) {
  let draws = 0;
  let lands: number | null = 0;
  for (const entry of entries) {
    if (entry.actorId !== playerId) continue;
    if (entry.kind === 'draw') draws += entry.drawCount ?? entry.count ?? 0;
    if (entry.kind === 'move' && entry.from === 'hand' && entry.to === 'battlefield') {
      if (entry.landPlays === undefined) lands = null;
      else if (lands !== null) lands += entry.landPlays;
    }
  }
  return { draws, lands };
}
