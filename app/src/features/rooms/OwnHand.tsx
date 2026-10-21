import { useRef, useState } from 'react';
import type { Card } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { PlayingCard } from './PlayingCard';

export function OwnHand({ cards = [], count, hoverZone, viewerId, gesture }: { cards?: Card[]; count: number; hoverZone: string | null; viewerId: number; gesture: CardGesture }) {
  const row = useRef<HTMLDivElement>(null);
  const [organizing, setOrganizing] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const ordered = [...cards].sort((a, b) => {
    const rank = (id: string) => order.includes(id) ? order.indexOf(id) : order.length + cards.findIndex(card => card.id === id);
    return rank(a.id) - rank(b.id);
  });
  const reorderAt = (card: Card, index: number) => {
    const ids = ordered.filter(item => item.id !== card.id).map(item => item.id);
    ids.splice(Math.max(0, index), 0, card.id);
    setOrder(ids);
  };
  return <section className={`table-zone zone-hand ${organizing ? 'is-organizing' : ''} ${hoverZone === 'hand' ? 'drop-hover' : ''}`} aria-label="Mão" data-drop-zone="hand">
    <header><span>Mão · {count}</span><button className="hand-organize secondary" aria-pressed={organizing} onClick={() => setOrganizing(value => !value)}>{organizing ? 'Concluir' : 'Organizar'}</button></header>
    <div ref={row} className="zone-cards" tabIndex={0} aria-label="Cartas da mão" onKeyDown={event => {
      if (!organizing || !event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const id = (event.target as HTMLElement).closest('[data-card-id]')?.getAttribute('data-card-id');
      const index = ordered.findIndex(card => card.id === id);
      if (index < 0) return;
      event.preventDefault();
      reorderAt(ordered[index], Math.min(ordered.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
    }}>
      {ordered.map(card => <PlayingCard key={card.id} card={card} draggable={card.controllerId === viewerId} scrollable={!organizing} {...gesture} onDragMove={(card, x, y) => {
        const box = row.current?.getBoundingClientRect();
        if (box && organizing) {
          if (x < box.left + 32) row.current!.scrollLeft -= 12;
          if (x > box.right - 32) row.current!.scrollLeft += 12;
        }
        gesture.onDragMove(card, x, y);
      }} onDragEnd={(card, x, y) => {
        const box = row.current?.getBoundingClientRect();
        if (box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
          const others = [...row.current!.querySelectorAll<HTMLElement>('[data-card-id]')].filter(node => node.dataset.cardId !== card.id);
          const index = others.findIndex(node => { const rect = node.getBoundingClientRect(); return x < rect.left + rect.width / 2; });
          reorderAt(card, index < 0 ? others.length : index);
          gesture.onDragCancel();
        } else gesture.onDragEnd(card, x, y);
      }} />)}
      {cards.length === 0 && <span className="zone-placeholder">Sua mão está vazia</span>}
    </div>
    <p className="hand-hint">{organizing ? 'Arraste para ordenar · Alt + ← / → no teclado' : 'Deslize para navegar · Segure para ler'}</p>
  </section>;
}

