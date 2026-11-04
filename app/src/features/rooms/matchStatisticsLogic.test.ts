import test from 'node:test';
import assert from 'node:assert/strict';
import { elapsedTime, turnStatistics } from './matchStatisticsLogic.ts';

test('elapsed time preserves hours, clamps future clocks and handles missing history', () => {
 const start = '2026-11-03T00:00:00Z';
 assert.equal(elapsedTime(start, Date.parse(start) + 90061000), '25:01:01');
 assert.equal(elapsedTime(start, Date.parse(start) - 1000), '00:00:00');
 assert.equal(elapsedTime(undefined, Date.now()), '—');
});

test('turn statistics exclude preparation draws and distinguish unknown land history', () => {
 const entry = { actorId: 1, actorName: 'Ana' };
 assert.deepEqual(turnStatistics([
  { ...entry, kind: 'draw', count: 7, drawCount: 0 },
  { ...entry, kind: 'draw', count: 2, drawCount: 2 },
  { ...entry, actorId: 2, kind: 'draw', count: 5 },
  { ...entry, kind: 'move', from: 'hand', to: 'battlefield', count: 3, landPlays: 2 },
  { ...entry, kind: 'move', from: 'library', to: 'battlefield', count: 4 },
 ], 1), { draws: 2, lands: 2 });
 assert.deepEqual(turnStatistics([{ ...entry, kind: 'move', from: 'hand', to: 'battlefield', count: 1 }], 1), { draws: 0, lands: null });
});
