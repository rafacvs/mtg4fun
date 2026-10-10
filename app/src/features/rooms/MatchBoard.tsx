import { useState } from 'react';
import { useMatch } from './useMatch';

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, roll, coin, turn } = useMatch(roomId);
  const [sides, setSides] = useState(20);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!match) return <p role="status">Carregando mesa…</p>;
  return <section className="match-board" aria-label="Mesa da partida">
    <p>Vida inicial: {match.initialLife}</p>
    <p>Ordem de turno: {match.turnOrder.map(turn => `${turn.name} (D20: ${turn.roll})`).join(', ')}</p>
    <p aria-live="polite">Turno atual: <strong>{match.currentTurn.name}</strong></p>
    <section className="match-actions" aria-label="Ações da partida">
      <label>Faces do dado <input aria-label="Faces do dado" type="number" min="2" max="100" value={sides} onChange={event => setSides(Number(event.target.value))} /></label>
      <button type="button" onClick={() => void roll(sides)}>Rolar dado</button>
      <button type="button" onClick={() => void coin()}>Jogar moeda</button>
      <button type="button" className="secondary" onClick={() => void turn('previous')}>Corrigir turno</button>
      <button type="button" onClick={() => void turn('next')}>Avançar turno</button>
    </section>
    <div className="match-players">{match.players.map(player => <article key={player.userId} className="match-player">
      <h4>{player.name}</h4>
      <p>Vida: {player.life}</p>
      <div className="zones" aria-label={`Zonas de ${player.name}`}>
        <Zone name="Grimório" count={player.libraryCount} />
        <Zone name="Mão" count={player.handCount} />
        <Zone name="Campo" count={player.battlefieldCount} />
        <Zone name="Cemitério" count={player.graveyardCount} />
        <Zone name="Exílio" count={player.exileCount} />
        <Zone name="Comando" count={player.commandCount} />
      </div>
    </article>)}</div>
    <section className="match-log" aria-label="Registro da partida"><h4>Registro</h4><ol>{match.events.map((event, index) => <li key={`${index}-${event.actor}`}>{event.actor}: {event.result}</li>)}</ol></section>
  </section>;
}

function Zone({ name, count }: { name: string; count: number }) {
  return <div className="zone"><span>{name}</span><strong>{count}</strong></div>;
}
