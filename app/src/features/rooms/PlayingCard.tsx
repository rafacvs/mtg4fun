import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';

const dragThreshold = 8;

type Props = {
  card: Card;
  draggable: boolean;
  onInspect: (card: Card) => void;
  onDragMove: (card: Card, x: number, y: number) => void;
  onDragEnd: (card: Card, x: number, y: number) => void;
  onDragCancel: () => void;
};

export function PlayingCard({ card, draggable, onInspect, onDragMove, onDragEnd, onDragCancel }: Props) {
  const [failed, setFailed] = useState(false);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const stopTracking = useRef<(() => void) | null>(null);
  const handlers = useRef({ onInspect, onDragMove, onDragEnd, onDragCancel });
  handlers.current = { onInspect, onDragMove, onDragEnd, onDragCancel };

  useEffect(() => () => stopTracking.current?.(), []);

  function pointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggable || event.button !== 0) return;
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
    className={`playing-card ${draggable ? 'can-drag' : ''}`}
    aria-label={card.name}
    onPointerDown={pointerDown}
    onClick={() => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      handlers.current.onInspect(card);
    }}
  >
    {failed
      ? <span className="card-fallback">{card.name}</span>
      : <img src={deckApi.imageURL(card.name)} alt="" draggable={false} onError={() => setFailed(true)} />}
  </button>;
}
