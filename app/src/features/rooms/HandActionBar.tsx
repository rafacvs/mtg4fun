import { useRef, useState, type CSSProperties } from 'react';
import { PanelHeader, TablePanel } from './TablePanel';
import { TableIcon } from './TableIcon';
import { cardImageURL } from './cardImage';
import { seatColors } from './PlayerSeat';
import type { Card, Match } from './roomsApi';
import './card-actions.css';

export function HandActionBar({ cards, players, viewerId, disabled, onPlay, onReveal, onClear }: {
  cards: Card[]; players: Match['players']; viewerId: number; disabled: boolean;
  onPlay: () => void; onReveal: (playerIds: number[]) => Promise<boolean>; onClear: () => void;
}) {
  const [revealOpen, setRevealOpen] = useState(false);
  const [chosen, setChosen] = useState<number[]>([]);
  const anchor = useRef<HTMLButtonElement>(null);
  const plural = cards.length > 1 ? 's' : '';
  const opponents = players.filter(player => player.userId !== viewerId);
  const revealedNow = cards.some(card => card.revealed || card.revealedTo?.length);
  const openReveal = () => {
    const first = cards[0]?.revealedTo ?? [];
    const same = cards.every(card => (card.revealedTo ?? []).join() === first.join());
    setChosen(same ? first : []);
    setRevealOpen(open => !open);
  };
  const toggle = (playerId: number) => setChosen(current => current.includes(playerId) ? current.filter(id => id !== playerId) : [...current, playerId]);
  return <>
    <div className="card-action-bar hand-action-bar" role="toolbar" aria-label="Ações da seleção na mão">
      <div className="selection-heading"><span className="selection-fan" aria-hidden="true">{cards.slice(0, 4).map((card, index) => <img key={card.id} src={cardImageURL(card)} alt="" style={{ '--fan-index': index } as CSSProperties} />)}</span><div><strong>{cards.length} carta{plural}</strong><span>da mão</span></div></div>
      <button className="secondary selection-marker-button" disabled={disabled} onClick={onPlay}><TableIcon name="focus" /><span>Campo</span></button>
      <button ref={anchor} className="secondary selection-marker-button" disabled={disabled || !opponents.length} aria-expanded={revealOpen} onClick={openReveal}><TableIcon name="eye" /><span>Revelar para jogadores</span><TableIcon name="chevron" /></button>
      <button className="secondary selection-close" aria-label="Limpar seleção" onClick={onClear}><TableIcon name="close" /></button>
    </div>
    <TablePanel open={revealOpen} label="Revelar para jogadores" anchor={anchor.current} align="above" onClose={() => setRevealOpen(false)} className="selection-marker-panel reveal-players-panel">
      <PanelHeader title="Revelar para jogadores" subtitle={`${cards.length} carta${plural}`} onClose={() => setRevealOpen(false)} />
      <div className="reveal-players" role="group" aria-label="Oponentes que veem as cartas">
        {opponents.map(player => <label key={player.userId} className="reveal-player" style={{ '--seat': seatColors[players.indexOf(player) % seatColors.length] } as CSSProperties}>
          <input type="checkbox" disabled={disabled} checked={chosen.includes(player.userId)} onChange={() => toggle(player.userId)} />
          <span aria-hidden="true" className="reveal-player-mark" />
          <span>{player.name}</span>
        </label>)}
      </div>
      <p className="selection-marker-hint">Só os jogadores marcados veem, até você ocultar ou o turno passar.</p>
      <button disabled={disabled || (!chosen.length && !revealedNow)} onClick={() => void onReveal(chosen).then(ok => { if (ok) setRevealOpen(false); })}>{chosen.length ? 'Revelar' : 'Ocultar de todos'}</button>
    </TablePanel>
  </>;
}
