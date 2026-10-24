import type { CSSProperties } from 'react';
import type { Match } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { overviewLayout } from './overviewLayout';
import { PlayingCard } from './PlayingCard';

// Compact only the projection. Persisted positions, rows and stacks stay intact.
export function OpponentField({ player, gesture }: { player: Match['players'][number]; gesture: CardGesture }) {
  const cards = player.battlefield ?? [];
  const layout = overviewLayout(cards);
  return <section className="table-zone zone-battlefield" aria-label="Campo" data-field-owner={player.userId}>
    <header><span>Campo</span><strong aria-label={`${player.battlefieldCount} cartas`}>{player.battlefieldCount}</strong></header>
    <div className="battlefield-guides" aria-hidden="true"><span>Permanentes</span><span>Terrenos</span></div>
    <div className="battlefield-scroll">
      <div className="opponent-canvas" style={{ '--mat-width': layout.width, '--mat-height': layout.height } as CSSProperties}>
        {cards.map(card => {
          const place = layout.cards.get(card.id);
          if (!place) return null;
          return <div key={card.id} className={`positioned-card ${card.tapped ? 'tapped-slot' : ''}`} style={{ left: `calc(${place.x} * var(--card-width))`, top: `calc(${place.y} * var(--card-width))`, zIndex: card.stackOrder }}>
            <PlayingCard card={card} draggable={false} {...gesture} />
          </div>;
        })}
      </div>
    </div>
  </section>;
}
