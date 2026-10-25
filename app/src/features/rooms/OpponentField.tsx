import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Match } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { overviewLayout } from './overviewLayout';
import { PlayingCard } from './PlayingCard';

// Compact only the projection. Persisted positions, rows and stacks stay intact.
export function OpponentField({ player, gesture }: { player: Match['players'][number]; gesture: CardGesture }) {
  const cards = player.battlefield ?? [];
  const layout = overviewLayout(cards);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState({ width: 0, height: 0, cardWidth: 44 });
  useEffect(() => {
    const node = fieldRef.current;
    if (!node) return;
    const measure = () => setVisible({
      width: node.clientWidth,
      height: node.clientHeight,
      cardWidth: Number.parseFloat(getComputedStyle(node).getPropertyValue('--card-width')) || 44,
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const scale = visible.width && visible.height && layout.width && layout.height
    ? Math.min(1, visible.width / (layout.width * visible.cardWidth), visible.height / (layout.height * visible.cardWidth))
    : 1;
  return <section className="table-zone zone-battlefield" aria-label="Campo" data-field-owner={player.userId}>
    <header><span>Campo</span><strong aria-label={`${player.battlefieldCount} cartas`}>{player.battlefieldCount}</strong></header>
    <div className="battlefield-fit" ref={fieldRef}>
      <div className="opponent-zoom-space" style={{ '--mat-width': layout.width, '--mat-height': layout.height, '--mat-zoom': scale } as CSSProperties}>
        <div className="opponent-canvas" style={{ '--mat-width': layout.width, '--mat-height': layout.height, '--mat-zoom': scale } as CSSProperties}>
        {cards.map(card => {
          const place = layout.cards.get(card.id);
          if (!place) return null;
          return <div key={card.id} className={`positioned-card ${card.tapped ? 'tapped-slot' : ''}`} style={{ left: `calc(${place.x} * var(--card-width))`, top: `calc(${place.y} * var(--card-width))`, zIndex: card.stackOrder }}>
            <PlayingCard card={card} draggable={false} {...gesture} />
          </div>;
        })}
        </div>
      </div>
    </div>
  </section>;
}
