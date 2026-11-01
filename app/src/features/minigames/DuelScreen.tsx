import { useEffect, useState } from 'react';
import panelCorner from '../../assets/theme/corner-v2.svg';
import type { CoinSide } from '../rooms/CoinOptions';
import { playerMark } from '../rooms/playerIdentity';
import { TableIcon } from '../rooms/TableIcon';
import type { Duels } from './CoinDuelLayer';
import { coinFlightMs, type CoinDuel, type CoinDuelOutcome } from './useCoinDuels';

const sides: CoinSide[] = ['Cara', 'Coroa'];
const sideIcon = (side: CoinSide) => side === 'Cara' ? 'coin-face' : 'crown';

function Coin({ side, spinning }: { side?: CoinSide; spinning?: boolean }) {
  return <div className={`duel-coin ${spinning ? 'is-spinning' : ''} ${side === 'Coroa' ? 'is-crown' : ''}`} aria-hidden="true">
    {side ? <TableIcon name={sideIcon(side)} /> : <b>?</b>}
    <span>{side ?? 'Cara ou coroa'}</span>
  </div>;
}

type Player = { id: number; name: string; note: string; side?: CoinSide; result?: 'won' | 'lost' };

function Contender({ player, own, art, seat, conflict, blocked, disabled, finished, onPick }: { player: Player; own: boolean; art: string; seat: number; conflict: boolean; blocked?: CoinSide; disabled: boolean; finished: boolean; onPick: (side: CoinSide) => void }) {
  return <section className={`duel-player seat-color-${seat} ${player.result ? `is-${player.result}` : ''}`} aria-label={own ? 'Sua escolha' : `Escolha de ${player.name}`}>
    <div className="duel-art">
      {player.result === 'won' && <span className="duel-winner-crown" aria-hidden="true"><TableIcon name="crown" /></span>}
      <img src={art} alt="" />
      <span className="dice-player-shield" aria-hidden="true">{playerMark(player.name)}</span>
      {player.result && <strong className="duel-stamp">{player.result === 'won' ? 'Venceu' : 'Perdeu'}</strong>}
    </div>
    <h3>{player.name}</h3>
    <small>{player.note}</small>
    <div className="duel-sides" role="group" aria-label={own ? 'Escolha um lado' : `Lado de ${player.name}`}>
      {sides.map(side => <button type="button" key={side} className={`duel-side ${side === 'Coroa' ? 'is-crown' : ''} ${player.side === side ? 'is-picked' : ''} ${conflict && player.side === side ? 'is-conflict' : ''} ${finished && player.side === side && player.result === 'won' ? 'is-winner' : ''}`} aria-pressed={player.side === side} disabled={!own || disabled || blocked === side} onClick={() => onPick(side)}><TableIcon name={sideIcon(side)} /><span>{side}</span></button>)}
    </div>
  </section>;
}

export function DuelScreen({ duel, outcome, userId, duels, artOf, seatOf }: { duel: CoinDuel | null; outcome: CoinDuelOutcome | null; userId: number; duels: Duels; artOf: (playerId: number) => string; seatOf: (playerId: number) => number }) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setLanded(true), coinFlightMs);
    return () => clearTimeout(timer);
  }, [outcome]);
  const decided = !!outcome && landed;
  const opponent = duel ? (duel.challengerId === userId ? { id: duel.opponentId, name: duel.opponentName } : { id: duel.challengerId, name: duel.challengerName })
    : outcome!.winnerId === userId ? { id: outcome!.loserId, name: outcome!.loserName } : { id: outcome!.winnerId, name: outcome!.winnerName };
  const ownName = duel ? (duel.challengerId === userId ? duel.challengerName : duel.opponentName) : outcome!.winnerId === userId ? outcome!.winnerName : outcome!.loserName;
  const mine = duel ? duel.picks[userId] : outcome!.winnerId === userId ? outcome!.winnerSide : outcome!.loserSide;
  const theirs = duel ? duel.picks[opponent.id] : outcome!.winnerId === userId ? outcome!.loserSide : outcome!.winnerSide;
  const ownConfirmed = !!duel?.confirmed[userId];
  const theirConfirmed = !!duel?.confirmed[opponent.id];
  const conflict = !!duel?.conflict;
  const resultOf = (id: number) => decided ? (outcome!.winnerId === id ? 'won' as const : 'lost' as const) : undefined;
  const label = !mine ? 'Escolha um lado' : conflict ? 'Escolham lados diferentes' : ownConfirmed ? 'Desconfirmar' : `Confirmar ${mine}`;
  return <div className="duel-backdrop">
    <section role="dialog" aria-modal="true" aria-label={`X1 contra ${opponent.name}`} className="duel-screen">
      <span className="duel-corners" aria-hidden="true">{[0, 1, 2, 3].map(corner => <img key={corner} src={panelCorner} alt="" />)}</span>
      <header>
        <div><p>X1 · Cara ou coroa</p><h2>{ownName} × {opponent.name}</h2></div>
        <small><TableIcon name="eye" />Só vocês dois veem esta tela · o resultado vai pra mesa toda</small>
      </header>
      <div className="duel-stage">
        <Contender own player={{ id: userId, name: ownName, note: ownConfirmed ? 'você · confirmou' : 'você', side: mine, result: resultOf(userId) }} art={artOf(userId)} seat={seatOf(userId)} conflict={conflict} blocked={theirConfirmed ? theirs : undefined} disabled={!duel || ownConfirmed || duels.pending} finished={decided} onPick={side => void duels.pick(side)} />
        <div className="duel-center">
          <Coin side={outcome ? (decided ? outcome.side : undefined) : mine} spinning={!!outcome && !landed} />
          {conflict && <p role="alert" className="duel-conflict">Os dois querem {mine}. Alguém vai ter que ceder.</p>}
          {!conflict && theirConfirmed && !ownConfirmed && duel && <p role="status" className="duel-center-note">{opponent.name} confirmou {theirs}.</p>}
          {!conflict && ownConfirmed && !theirConfirmed && <p role="status" className="duel-center-note">Aguardando {opponent.name} confirmar.</p>}
          {outcome && !landed && <p role="status" className="duel-center-note">A moeda está no ar…</p>}
          {decided && <p role="status" className="duel-result-title">Deu {outcome!.side}!</p>}
          {duels.error && <p role="alert" className="duel-error">{duels.error}</p>}
        </div>
        <Contender own={false} player={{ id: opponent.id, name: opponent.name, note: theirs ? `${theirConfirmed ? 'confirmou' : 'escolheu'} ${theirs}` : 'escolhendo…', side: theirs, result: resultOf(opponent.id) }} art={artOf(opponent.id)} seat={seatOf(opponent.id)} conflict={conflict} disabled finished={decided} onPick={() => {}} />
      </div>
      <footer>
        {duel
          ? <><button type="button" className="duel-forfeit" disabled={duels.pending} onClick={() => void duels.forfeit()}>Arregar (conta como derrota)</button>
            <button type="button" className="duel-primary duel-confirm" disabled={duels.pending || !mine || conflict} onClick={() => void (ownConfirmed ? duels.unconfirm() : duels.confirm())}>{label}</button></>
          : decided && <div className="duel-leaving" role="status"><span>Voltando pra mesa…</span><i aria-hidden="true" /></div>}
      </footer>
    </section>
  </div>;
}
