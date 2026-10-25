import { NumericCounter } from './CounterControls';
import { MarkerReadout } from './CounterValues';
import type { CounterAction, Match } from './roomsApi';

export const seatColors = ['#6cb4f5', '#f27bb0', '#b49af7', '#4fd1b0', '#f2a46f', '#c9cb70'];

export function PlayerSeat({ player, own, turnPosition, currentTurn, disabled, onCounter, onMenu }: {
  player: Match['players'][number]; own: boolean; turnPosition: number; currentTurn: boolean; disabled: boolean;
  onCounter: (input: CounterAction) => Promise<boolean>; onMenu: (anchor: HTMLElement) => void;
}) {
  return <header className="seat-heading">
    <span className="seat-number" title={`Posição na ordem do turno: ${turnPosition}`}>{turnPosition}</span>
    <div className="seat-name"><h2>{player.name}</h2><small>{own ? 'Você' : `Mão: ${player.handCount} · Privada`}</small>{currentTurn && <span className="seat-turn">Na vez</span>}</div>
    {own ? <div className="seat-life" aria-label={`Vida: ${player.life}`}><span>Vida</span><NumericCounter label="vida" inputLabel="Vida" value={player.life} textual disabled={disabled} onApply={(operation, value) => onCounter({ target: 'player', playerId: player.userId, subject: 'life', operation, value })} /></div>
      : <strong className="seat-life-readout" aria-label={`Vida: ${player.life}`}>{player.life}</strong>}
    <button className="seat-markers secondary" aria-label={`Abrir jogador ${player.name}`} title="Vida e marcadores" onClick={event => onMenu(event.currentTarget)}>
      <MarkerReadout markers={player.markers} />
    </button>
  </header>;
}
