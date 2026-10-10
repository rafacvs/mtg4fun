import { useState } from 'react';
import type { Card } from './roomsApi';
import { useMatch } from './useMatch';

const names: Record<string, string> = { library: 'Grimório', hand: 'Mão', battlefield: 'Campo', graveyard: 'Cemitério', exile: 'Exílio', command: 'Comando' };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, draw, move } = useMatch(roomId);
  const [count, setCount] = useState(1);
  const [selected, setSelected] = useState<Card | null>(null);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!match) return <p role="status">Carregando mesa…</p>;
  const canMove = selected?.controllerId === match.viewerId;
  const sendMove = (to: string, placement?: 'top' | 'bottom') => { if (selected) { void move([selected.id], to, placement); setSelected(null); } };
  return <section className="match-board" aria-label="Mesa da partida">
    <p>Vida inicial: {match.initialLife}</p>
    <p>Ordem de turno: {match.turnOrder.map(turn => `${turn.name} (D20: ${turn.roll})`).join(', ')}</p>
    <section className="match-actions" aria-label="Ações da partida">
      <label>Comprar <input aria-label="Quantidade para comprar" type="number" min="1" value={count} onChange={event => setCount(Number(event.target.value))} /></label>
      <button type="button" onClick={() => void draw(count)}>Comprar cartas</button>
      {selected && <p role="status">Selecionada: {selected.name}</p>}
      {canMove && <div className="move-actions" aria-label="Mover carta selecionada">
        {Object.entries(names).map(([zone, label]) => <button type="button" key={zone} onClick={() => sendMove(zone)}>{`Mover para ${label}`}</button>)}
        <button type="button" onClick={() => sendMove('library', 'top')}>Topo do grimório</button>
        <button type="button" onClick={() => sendMove('library', 'bottom')}>Fundo do grimório</button>
      </div>}
    </section>
    <div className="match-players">{match.players.map(player => <article key={player.userId} className="match-player">
      <h4>{player.name}</h4><p>Vida: {player.life}</p>
      <div className="zones" aria-label={`Zonas de ${player.name}`}>
        <Zone name="Grimório" count={player.libraryCount} />
        <CardsZone name="Mão" count={player.handCount} cards={player.hand} onSelect={setSelected} selected={selected?.id} />
        <CardsZone name="Campo" count={player.battlefieldCount} cards={player.battlefield} onSelect={setSelected} selected={selected?.id} />
        <CardsZone name="Cemitério" count={player.graveyardCount} cards={player.graveyard} onSelect={setSelected} selected={selected?.id} />
        <CardsZone name="Exílio" count={player.exileCount} cards={player.exile} onSelect={setSelected} selected={selected?.id} />
        <CardsZone name="Comando" count={player.commandCount} cards={player.command} onSelect={setSelected} selected={selected?.id} />
      </div>
    </article>)}</div>
    <section className="match-log" aria-label="Registro da partida"><h4>Registro</h4><ol>{match.log.map((entry, index) => <li key={`${index}-${entry.actorName}`}>{describe(entry)}</li>)}</ol></section>
  </section>;
}

function Zone({ name, count }: { name: string; count: number }) { return <div className="zone"><span>{name}</span><strong>{count}</strong></div>; }
function CardsZone({ name, count, cards = [], onSelect, selected }: { name: string; count: number; cards?: Card[]; onSelect: (card: Card) => void; selected?: string }) { return <div className="zone cards-zone"><span>{name}</span><strong>{count}</strong>{cards.map(card => <button className={selected === card.id ? 'selected-card' : ''} type="button" key={card.id} onClick={() => onSelect(card)}>{card.name}</button>)}</div>; }
function describe(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number }) { if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`; if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${names[entry.from || ''] || entry.from} para ${names[entry.to || ''] || entry.to}.`; return 'Partida iniciada.'; }
