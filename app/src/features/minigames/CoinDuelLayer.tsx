import { createPortal } from 'react-dom';
import './coin-duel.css';
import { ChallengeMenu } from './ChallengeMenu';
import { DuelInvite } from './DuelInvite';
import { DuelScreen } from './DuelScreen';
import type { useCoinDuels } from './useCoinDuels';

export type Duels = ReturnType<typeof useCoinDuels>;

export function CoinDuelLayer({ duels, userId, artOf, seatOf }: { duels: Duels; userId: number; artOf: (playerId: number) => string; seatOf: (playerId: number) => number }) {
  const { own, flip, target, notice } = duels;
  const playing = own?.status === 'playing' || !!flip;
  return createPortal(<div className="coin-duel-layer">
    {target && !own && !flip && <ChallengeMenu target={target} seat={seatOf(target.id)} duels={duels} />}
    {own?.status === 'invited' && !flip && <DuelInvite duel={own} userId={userId} duels={duels} />}
    {playing && <DuelScreen key={flip?.duelId ?? own?.id} duel={flip ? null : own} outcome={flip} userId={userId} duels={duels} artOf={artOf} seatOf={seatOf} />}
    {notice && <p className="coin-duel-notice" role="status">{notice}</p>}
  </div>, document.body);
}
