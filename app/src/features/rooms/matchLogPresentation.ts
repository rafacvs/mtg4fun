import { zoneNames } from './PlayerTable';
import type { Match } from './roomsApi';

export type LogEntry = Match['log'][number];
export type LogFilter = 'game' | 'adjustments' | 'all';

export function isLogAdjustment(entry: LogEntry) {
  return ['position', 'reorder', 'reorder_zone', 'consult', 'close'].includes(entry.kind);
}

export type LogLine = { index: number; entry: LogEntry; actions: number };
export type LogTurn = { number: number; lines: LogLine[] };

// Turn changes and adjacency come from the ordered public log. Filtering happens
// after grouping so a hidden adjustment cannot join two separate plays.
export function groupLogTurns(entries: LogEntry[]): LogTurn[] {
  const turns: LogTurn[] = [{ number: 1, lines: [] }];
  entries.forEach((entry, index) => {
    if (entry.kind === 'turn') turns.push({ number: turns.length + 1, lines: [] });
    const lines = turns[turns.length - 1].lines;
    const previous = lines[lines.length - 1];
    if (previous && canJoin(previous.entry, entry)) {
      const cards = [...previous.entry.cards ?? [], ...entry.cards ?? []];
      previous.entry = {
        ...previous.entry,
        count: (previous.entry.count ?? 0) + (entry.count ?? 0),
        cards: cards.filter((card, i) => cards.findIndex(other => other.id === card.id) === i),
      };
      previous.actions += 1;
    } else lines.push({ index, entry: { ...entry }, actions: 1 });
  });
  return turns.reverse().map(turn => ({ ...turn, lines: turn.lines.reverse() }));
}

function canJoin(previous: LogEntry, next: LogEntry) {
  return !['turn', 'started', 'start', 'finished', 'finish_vote'].includes(next.kind)
    && previous.actorId === next.actorId && previous.kind === next.kind
    && previous.from === next.from && previous.to === next.to && previous.result === next.result;
}

export function describeLogLine(line: LogLine) {
  const description = describeLogEntry(line.entry);
  const countIsDescribed = ['set_tapped', 'set_face_down', 'hide_all_revealed', 'reveal_cards_to', 'draw', 'move', 'position'].includes(line.entry.kind);
  return line.actions > 1 && !countIsDescribed ? `${description} (${line.actions} ações seguidas)` : description;
}

export function describeLogEntry(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number; result?: string }) {
  if (entry.kind === 'finish_vote') return `${entry.actorName} concordou em finalizar a partida (${entry.result}).`;
  if (entry.kind === 'finished') return `${entry.actorName} confirmou o encerramento da partida (${entry.result}). Sala encerrada.`;
  if (entry.kind === 'create-token' || entry.kind === 'create-custom-token') return `${entry.actorName} criou a ficha ${entry.result}.`;
  if (entry.kind === 'copy-card') return `${entry.actorName} criou uma cópia de ${entry.result}.`;
  if (entry.kind === 'set_tapped') return `${entry.actorName} alterou virar/desvirar de ${entry.count} carta(s).`;
  if (entry.kind === 'untap_all') return `${entry.actorName} desvirou todas as cartas do próprio campo.`;
  if (entry.kind === 'set_face') return `${entry.actorName} escolheu uma face da carta.`;
  if (entry.kind === 'set_face_down') return `${entry.actorName} alterou face para baixo de ${entry.count} carta(s).`;
  if (entry.kind === 'reveal_cards') return entry.result ? `${entry.actorName} revelou ${entry.result}.` : `${entry.actorName} ocultou uma revelação.`;
  if (entry.kind === 'reveal_cards_to') return `${entry.actorName} revelou ${entry.count} carta(s) da mão para ${entry.result}.`;
  if (entry.kind === 'hide_all_revealed') return `${entry.actorName} ocultou todas as suas reveladas (${entry.count}).`;
  if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`;
  if (entry.kind === 'mulligan') return `${entry.actorName} embaralhou a mão e comprou sete novas cartas (mulligan ${entry.count}).`;
  if (entry.kind === 'keep_hand') return `${entry.actorName} ${entry.result}.`;
  if (entry.kind === 'move' && entry.result) return `${entry.actorName}: ${entry.result} ao mover para ${zoneNames[entry.to || ''] || entry.to}.`;
  if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${zoneNames[entry.from || ''] || entry.from} para ${zoneNames[entry.to || ''] || entry.to}.`;
  if (entry.kind === 'transfer_control') return `${entry.actorName} transferiu o controle de uma carta para ${entry.result}.`;
  if (entry.kind === 'position') return `${entry.actorName} reposicionou ${entry.count || 1} carta(s) no campo.`;
  if (entry.kind === 'roll') return `${entry.actorName} rolou ${entry.result}.`;
  if (entry.kind === 'counter') return `${entry.actorName} alterou contadores: ${entry.result}.`;
  if (entry.kind === 'coin') return `${entry.actorName} jogou uma moeda: ${entry.result}.`;
  if (entry.kind === 'turn') return `${entry.actorName} ${entry.result}.`;
  if (entry.kind === 'consult') return `${entry.actorName} consultou o grimório em privado.`;
  if (entry.kind === 'reveal') return `${entry.actorName} revelou ${entry.result}.`;
  if (entry.kind === 'reorder_zone') return `${entry.actorName} reordenou ${entry.to === 'exile' ? 'o exílio' : 'o cemitério'}.`;
  if (entry.kind === 'reorder') return `${entry.actorName} reorganizou uma consulta privada.`;
  if (entry.kind === 'close') return `${entry.actorName} fechou a consulta do grimório.`;
  if (entry.kind === 'shuffle') return `${entry.actorName} embaralhou o grimório.`;
  return 'Partida iniciada.';
}

// Rolls are logged as "D20: 17"; the game menu shows the die and its value.
export function parseRoll(result = '') {
  const match = /^D(\d+): (\d+)$/.exec(result);
  return match ? { sides: Number(match[1]), value: Number(match[2]) } : null;
}

export function describeActionResult(entry: LogEntry) {
  const roll = entry.kind === 'roll' ? parseRoll(entry.result) : null;
  return roll ? `${entry.actorName} rolou um d${roll.sides}: ${roll.value}.` : describeLogEntry(entry);
}
