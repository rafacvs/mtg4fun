import { useRef, useState } from 'react';
import type { Card } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { PlayingCard } from './PlayingCard';
import { PanelHeader, TablePanel } from './TablePanel';
import './public-zone-viewer.css';

export function PublicZoneViewer({ title, playerName, cards, anchor, viewerId, disabled, gesture, onInspect, onReorder, onClose }: {
  title: string;
  playerName: string;
  cards: Card[];
  anchor: HTMLElement | null;
  viewerId: number;
  disabled: boolean;
  gesture: CardGesture;
  onInspect: (card: Card) => void;
  onReorder?: (ids: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  // Shown from the top down; the zone stores its top as the last card.
  const shown = [...cards].reverse();
  const list = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState('');
  const [target, setTarget] = useState('');
  const stopMoving = () => { setMoving(''); setTarget(''); };
  const reorder = (id: string, targetID: string) => {
    const from = shown.findIndex(card => card.id === id);
    const to = shown.findIndex(card => card.id === targetID);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...shown];
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    void onReorder?.(next.reverse().map(item => item.id));
  };
  const cardAt = (card: Card, x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-zone-card-id]');
    const id = element && list.current?.contains(element) ? element.dataset.zoneCardId ?? '' : '';
    return id === card.id ? '' : id;
  };
  // Dropped on another card it changes the order; anywhere else it stays a normal card drag.
  const cardGesture: CardGesture = !onReorder ? gesture : {
    ...gesture,
    onDragMove: (card, x, y) => {
      setMoving(card.id);
      setTarget(cardAt(card, x, y));
      const box = list.current?.getBoundingClientRect();
      if (box && list.current && x >= box.left && x <= box.right) list.current.scrollTop += y < box.top + 28 && y >= box.top - 28 ? -8 : y > box.bottom - 28 && y <= box.bottom + 28 ? 8 : 0;
      gesture.onDragMove(card, x, y);
    },
    onDragEnd: (card, x, y) => {
      const dropped = cardAt(card, x, y);
      stopMoving();
      if (dropped) { gesture.onDragCancel(); reorder(card.id, dropped); }
      else gesture.onDragEnd(card, x, y);
    },
    onDragCancel: () => { stopMoving(); gesture.onDragCancel(); },
  };
  return <TablePanel open anchor={anchor} wide label={`${title} de ${playerName}`} className="public-zone-viewer" onClose={onClose}>
    <PanelHeader title={`${title} de ${playerName}`} subtitle={cards.length === 1 ? '1 carta' : `${cards.length} cartas`} closeLabel={`Fechar ${title.toLocaleLowerCase('pt-BR')}`} onClose={onClose} />
    <div ref={list} className="public-zone-cards" aria-label={`Cartas no ${title.toLocaleLowerCase('pt-BR')}`}>
      {shown.map((card, index) => <article
        key={card.id}
        data-zone-card-id={card.id}
        className={`public-zone-card ${moving === card.id ? 'dragging' : ''} ${target === card.id ? 'drag-target' : ''}`}
        onKeyDown={event => {
          const offset = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
          const neighbour = shown[index + offset];
          if (!onReorder || !offset || disabled) return;
          event.preventDefault();
          if (neighbour) reorder(card.id, neighbour.id);
        }}
      >
        <PlayingCard {...cardGesture} card={card} draggable={!disabled && card.controllerId === viewerId} ariaLabel={`Ver imagem de ${card.name}`} onInspect={() => onInspect(card)} />
        <span><strong>{card.name}</strong>{index === 0 && <small>Topo</small>}</span>
      </article>)}
    </div>
  </TablePanel>;
}
