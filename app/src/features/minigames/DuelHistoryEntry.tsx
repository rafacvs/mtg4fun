import type { CSSProperties } from 'react';
import { playerMark } from '../rooms/playerIdentity';
import { TableIcon } from '../rooms/TableIcon';
import type { CoinDuelOutcome } from './useCoinDuels';

export function relativeTime(at: number, now: number) {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return 'agora';
  return minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)} h`;
}

const verbs = { flip: 'perdeu o x1 pra', forfeit: 'arregou o x1 contra', refused: 'recusou o x1 de' };

export function DuelHistoryEntry({ outcome, now, color }: { outcome: CoinDuelOutcome; now: number; color: string }) {
  return <li className="dice-register-duel" style={{ '--player-color': color } as CSSProperties}>
    <span className="dice-player-shield" aria-hidden="true">{playerMark(outcome.loserName)}</span>
    <span className="dice-register-copy">
      <span><b>{outcome.loserName}</b> {verbs[outcome.kind]} <b className="is-winner">{outcome.winnerName}</b></span>
      <small>Cara ou coroa{outcome.side ? ` · deu ${outcome.side}` : ''} · {relativeTime(outcome.at, now)}</small>
    </span>
    <span className="duel-coin-mini" aria-hidden="true"><TableIcon name="crown" /></span>
  </li>;
}
