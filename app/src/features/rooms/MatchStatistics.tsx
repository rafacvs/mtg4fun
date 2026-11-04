import { useEffect, useState, type CSSProperties } from 'react';
import type { Match } from './roomsApi';
import { TableIcon } from './TableIcon';
import { elapsedTime, turnStatistics } from './matchStatisticsLogic';
import './match-statistics.css';

export function MatchTimers({ match }: { match: Match }) {
  const [now, setNow] = useState(Date.now);
  const [clock, setClock] = useState(() => ({ server: Date.parse(match.serverTime ?? '') || Date.now(), local: Date.now() }));
  useEffect(() => {
    setClock({ server: Date.parse(match.serverTime ?? '') || Date.now(), local: Date.now() });
  }, [match.serverTime]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const end = match.finishedAt ? Date.parse(match.finishedAt) : clock.server + now - clock.local;
  return <div className="match-timers" role="group" aria-label="Tempo da sala e da partida">
    <TableIcon name="clock" />
    <div><span>Sala</span><output aria-label="Tempo de sala">{elapsedTime(match.roomCreatedAt, end)}</output></div>
    <div><span>Partida</span><output aria-label="Tempo de partida">{elapsedTime(match.startedAt, end)}</output></div>
  </div>;
}

export function TurnStatistics({ players, entries, turn }: { players: Match['players']; entries: Match['log']; turn: number }) {
  return <div className="turn-statistics" role="group" aria-label={`Resumo do turno ${turn}`}>
    <div className="turn-statistics-heading"><span>Jogador</span><span title="Cartas compradas no turno"><TableIcon name="draw" />Compras</span><span title="Terrenos da mão para o campo neste turno"><TableIcon name="type-land" />Terrenos</span></div>
    {players.map(player => {
      const { draws, lands } = turnStatistics(entries, player.userId);
      return <div className="turn-statistics-player" key={player.userId} style={{ '--player-color': `var(--seat-${player.userId}, var(--gold))` } as CSSProperties}>
        <span title={player.name}>{player.name}</span>
        <strong aria-label={`Compras de ${player.name} no turno ${turn}`}>{draws}</strong>
        <strong aria-label={`Terrenos jogados por ${player.name} no turno ${turn}`} title={lands === null ? 'Este histórico contém movimentos anteriores à contagem de terrenos' : undefined}>{lands ?? '—'}</strong>
      </div>;
    })}
  </div>;
}
