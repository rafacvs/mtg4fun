import { useEffect, useRef, useState } from 'react';
import { cardImageURL } from './cardImage';
import { CardStats } from './CounterValues';
import type { Card } from './roomsApi';

const dragThreshold = 8;

type Props = {
  card: Card;
  draggable: boolean;
  onInspect: (card: Card) => void;
  onToggleTapped?: (card: Card) => void;
  onDragMove: (card: Card, x: number, y: number) => void;
  onDragEnd: (card: Card, x: number, y: number) => void;
  onDragCancel: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  onSelect?: (card: Card) => void;
};

export function PlayingCard({ card, draggable, onInspect, onDragMove, onDragEnd, onDragCancel, onToggleTapped, selected, selectionMode, onSelect }: Props) {
  const [failed, setFailed] = useState(false);
  const dragging = useRef(false);
  const clickTimer = useRef<number | null>(null);
  const pointerType = useRef('mouse');
  const suppressClick = useRef(false);
  const stopTracking = useRef<(() => void) | null>(null);
  const handlers = useRef({ onInspect, onDragMove, onDragEnd, onDragCancel });
  handlers.current = { onInspect, onDragMove, onDragEnd, onDragCancel };

  useEffect(() => () => { stopTracking.current?.(); if (clickTimer.current) window.clearTimeout(clickTimer.current); }, []);
  useEffect(() => setFailed(false), [card.imageName, card.name, card.faceIndex]);

  function pointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    pointerType.current = event.pointerType;
    if (!draggable || event.pointerType === 'mouse' && event.button !== 0) return;
    stopTracking.current?.();
    suppressClick.current = false;
    dragging.current = false;
    const pointerId = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY };

    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      if (!dragging.current && Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y) < dragThreshold) return;
      dragging.current = true;
      handlers.current.onDragMove(card, pointer.clientX, pointer.clientY);
    };
    const up = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      cleanup();
      const moved = dragging.current || Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y) >= dragThreshold;
      dragging.current = false;
      if (!moved) return;
      suppressClick.current = true;
      handlers.current.onDragEnd(card, pointer.clientX, pointer.clientY);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      stopTracking.current = null;
    };
    stopTracking.current = () => {
      cleanup();
      if (dragging.current) handlers.current.onDragCancel();
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return <button
    type="button"
    className={`playing-card ${draggable ? 'can-drag' : ''} ${card.tapped ? 'is-tapped' : ''} ${card.faceDown ? 'is-face-down' : ''} ${selected ? 'is-selected' : ''}`}
    aria-label={card.name || 'Carta face para baixo'}
    data-tapped={Boolean(card.tapped)}
    data-face-down={Boolean(card.faceDown)}
    onPointerDown={pointerDown}
    onDoubleClick={() => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      if (draggable && card.zone === 'battlefield' && pointerType.current === 'mouse') onToggleTapped?.(card);
    }}
    onClick={event => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      if (selectionMode && draggable) { onSelect?.(card); return; }
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      if (draggable && card.zone === 'battlefield' && pointerType.current === 'mouse' && event.detail > 0) {
        if (event.detail === 1) clickTimer.current = window.setTimeout(() => handlers.current.onInspect(card), 350);
      } else handlers.current.onInspect(card);
    }}
  >
    {card.faceDown || !card.name ? <span className="card-back">Face para baixo{card.revealed && <small>Revelada</small>}</span> : failed
      ? <span className="card-fallback">{card.name}</span>
      : <img src={cardImageURL(card)} alt="" draggable={false} onError={() => setFailed(true)} />}
    <CardStats power={card.power} toughness={card.toughness} markers={card.markers} />
  </button>;
}
