import { TableIcon } from '../rooms/TableIcon';
import type { Duels } from './CoinDuelLayer';
import type { CoinDuel } from './useCoinDuels';

// Cai sobre a mesa: quem foi chamado responde, quem chamou pode desistir enquanto espera.
export function DuelInvite({ duel, userId, duels }: { duel: CoinDuel; userId: number; duels: Duels }) {
  const invited = duel.opponentId === userId;
  return <section role="dialog" aria-label={invited ? 'Convite para um X1' : 'Aguardando resposta do X1'} className="duel-invite">
    <span className="duel-coin-mini is-large" aria-hidden="true"><TableIcon name="crown" /></span>
    {invited
      ? <div><p><b>{duel.challengerName}</b> te chamou pro x1 de cara ou coroa</p><small>Quem perder fica marcado na mesa. Quem recusar também.</small>{duels.error && <small role="alert" className="duel-error">{duels.error}</small>}</div>
      : <div><p>Chamando <b>{duel.opponentName}</b> pro x1 de cara ou coroa</p><small>Aguardando a resposta.</small>{duels.error && <small role="alert" className="duel-error">{duels.error}</small>}</div>}
    {invited
      ? <div className="duel-invite-actions"><button type="button" className="duel-secondary" disabled={duels.pending} onClick={() => void duels.refuse()}>Recusar</button><button type="button" className="duel-primary" disabled={duels.pending} onClick={() => void duels.accept()}>Aceitar</button></div>
      : <div className="duel-invite-actions"><button type="button" className="duel-secondary" disabled={duels.pending} onClick={() => void duels.cancel()}>Cancelar</button></div>}
  </section>;
}
