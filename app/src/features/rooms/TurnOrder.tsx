import type { CSSProperties } from 'react';
import { seatColors } from './PlayerSeat';
import type { Match } from './roomsApi';

export function TurnOrder({ match }: { match: Match }) {
  return <div className="turn-order-display" aria-label="Ordem de turnos"><span className="turn-order-title">Turno</span><ol>{match.turnOrder.map((player, index) => {
    const seatIndex = match.players.findIndex(seat => seat.userId === player.userId);
    return <li key={player.userId} className={player.userId === match.currentTurn.userId ? 'current' : ''} style={{ '--order-color': seatColors[Math.max(seatIndex, 0) % seatColors.length] } as CSSProperties}>{index > 0 && <span className="turn-order-arrow" aria-hidden="true">›</span>}<span className="turn-order-shield">{index + 1}</span><span>{player.name}</span></li>;
  })}</ol></div>;
}
