import { useState, type CSSProperties } from 'react';
import { useLiveChannel, useLiveStatus } from '../live/LiveRoom';
import { seatColors } from './PlayerSeat';
import type { Match } from './roomsApi';
import './match-presence.css';

type Status = 'online' | 'away';
export function MatchPresence({ match }: { match: Match }) {
  const [presence, setPresence] = useState<Record<string, Status>>({});
  const connection = useLiveStatus();
  useLiveChannel('presence', message => {
    if (message.type === 'snapshot' || message.type === 'state') setPresence(message.data ?? {});
  });
  const ordered = match.players.map((player, index) => ({ player, index, position: match.turnOrder.findIndex(turn => turn.userId === player.userId) + 1 }))
    .sort((a, b) => (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER));
  return <div className="match-presence" role="group" aria-label="Presença dos jogadores">
    {ordered.map(({ player, index, position }) => {
      const state = connection !== 'open' ? 'unknown' : presence[player.userId] ?? 'offline';
      const label = { online: 'na partida', away: 'em outra guia', offline: 'desconectado', unknown: 'conexão indisponível' }[state];
      return <div className="match-presence-player" key={player.userId} title={`${player.name}: ${label}`} aria-label={`${player.name}: ${label}`}>
        <span className="match-presence-shield" style={{ '--presence-color': seatColors[index % seatColors.length] } as CSSProperties}>{position || index + 1}</span>
        <span className={`match-presence-dot is-${state}`} aria-hidden="true" />
      </div>;
    })}
  </div>;
}
