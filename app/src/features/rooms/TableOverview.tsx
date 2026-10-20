import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CARD_ASPECT, battlefieldLayout } from './battlefieldLayout';
import { cardImageURL } from './cardImage';
import { TableIcon } from './TableIcon';
import type { Match } from './roomsApi';

export function TableOverview({ match, onFocus }: { match: Match; onFocus: (id: number) => void }) {
  return <div className="table-overview" aria-label="Visão geral das mesas">{match.players.map(player => <OverviewPlayer key={player.userId} player={player} own={player.userId === match.viewerId} currentTurn={player.userId === match.currentTurn.userId} onFocus={() => onFocus(player.userId)} />)}</div>;
}

function OverviewPlayer({ player, own, currentTurn, onFocus }: { player: Match['players'][number]; own: boolean; currentTurn: boolean; onFocus: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.15);
  const cards = player.battlefield ?? [];
  const layout = battlefieldLayout(cards, 0, 0);
  const unit = 72;
  const width = Math.max(unit, layout.width * unit);
  const height = Math.max(unit * CARD_ASPECT, layout.height * unit);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const update = () => setScale(Math.min(node.clientWidth / width, node.clientHeight / height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height]);
  return <button className={`overview-player secondary ${currentTurn ? 'is-current-turn' : ''}`} onClick={onFocus} aria-label={`Ampliar mesa de ${player.name}`}>
    <header><span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}{own && <small> · Você</small>}</strong><span aria-label={`Vida: ${player.life}`}><TableIcon name="heart" />{player.life}</span></header>
    <div ref={ref} className="overview-field">
      {cards.length ? <div style={{ width, height, transform: `scale(${scale})` }} className="overview-canvas">{cards.map(card => {
        const item = layout.cards.get(card.id);
        if (!item) return null;
        return <div key={card.id} className={`overview-card ${card.tapped ? 'is-tapped' : ''}`} style={{ left: item.x * unit, top: item.y * unit, width: (card.tapped ? CARD_ASPECT : 1) * unit, height: (card.tapped ? 1 : CARD_ASPECT) * unit, zIndex: card.stackOrder } as CSSProperties}>{card.name && !card.faceDown ? <img src={cardImageURL(card)} alt="" draggable={false} /> : <span className="card-back" />}</div>;
      })}</div> : <div className="overview-empty"><TableIcon name="crown" /><span>Campo livre</span></div>}
    </div>
    <footer><span><TableIcon name="hand" />{player.handCount}</span><span><TableIcon name="library" />{player.libraryCount}</span><span>{player.battlefieldCount} no campo</span>{currentTurn && <span className="turn-badge">Turno</span>}</footer>
  </button>;
}
