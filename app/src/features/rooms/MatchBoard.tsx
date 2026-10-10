import { useMatch } from './useMatch';

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error } = useMatch(roomId);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!match) return <p role="status">Carregando mesa…</p>;
  return <section className="match-board" aria-label="Mesa da partida">
    <p>Vida inicial: {match.initialLife}</p>
    <p>Ordem de turno: {match.turnOrder.map(turn => `${turn.name} (D20: ${turn.roll})`).join(', ')}</p>
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
  </section>;
}

function Zone({ name, count }: { name: string; count: number }) {
  return <div className="zone"><span>{name}</span><strong>{count}</strong></div>;
}
