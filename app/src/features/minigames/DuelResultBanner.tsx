import { playerMark } from '../rooms/playerIdentity';
import { TableIcon } from '../rooms/TableIcon';
import type { CoinDuelOutcome } from './useCoinDuels';

// O anúncio vai para a mesa toda, por cima do feltro.
export function DuelResultBanner({ outcome, seatOf }: { outcome: CoinDuelOutcome | null; seatOf: (playerId: number) => number }) {
  if (!outcome) return null;
  const flip = outcome.kind === 'flip';
  const title = flip ? `${outcome.loserName} perdeu pra uma moeda.` : outcome.kind === 'forfeit' ? `${outcome.loserName} arregou.` : `${outcome.loserName} recusou o X1.`;
  const line = flip ? 'Uma moeda. Sem deck, sem estratégia, sem nada. Só uma moeda.' : 'Nem precisou de moeda.';
  return <section className="duel-banner" role="status" aria-label="Resultado do X1">
    <span className="duel-coin-mini is-medal" aria-hidden="true"><TableIcon name="crown" /></span>
    <p>Resultado do X1 · Cara ou coroa</p>
    <h2>{title}</h2>
    <span className="duel-banner-line">{line}</span>
    {flip && <div className="duel-banner-chips">
      <span className={`is-loser seat-color-${seatOf(outcome.loserId)}`}><i className="dice-player-shield" aria-hidden="true" /><b>{outcome.loserName}</b> escolheu {outcome.loserSide} ✗</span>
      <span className={`is-winner seat-color-${seatOf(outcome.winnerId)}`}><i className="dice-player-shield" aria-hidden="true" /><b>{outcome.winnerName}</b> ficou com {outcome.winnerSide} ✓</span>
    </div>}
  </section>;
}
