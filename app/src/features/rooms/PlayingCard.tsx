import { useEffect, useRef, useState } from 'react';
import { cardImageURL } from './cardImage';
import { CardStats } from './CounterValues';
import type { Card } from './roomsApi';

const dragThreshold = 8;

type Props = {
  card: Card;
  draggable: boolean;
  scrollable?: boolean;
  onPreview?: (card: Card) => void;
  selected?: boolean;
  onInspect: (card: Card) => void;
  onHover?: (card: Card) => void;
  onZoom?: (card: Card | null) => void;
  onToggleTapped?: (card: Card) => void;
  onDragMove: (card: Card, x: number, y: number) => void;
  onDragEnd: (card: Card, x: number, y: number) => void;
  onDragCancel: () => void;
};

export function PlayingCard({ card, draggable, scrollable = false, onPreview, onInspect, onHover, onZoom, onDragMove, onDragEnd, onDragCancel, onToggleTapped, selected }: Props) {
  const [failed, setFailed] = useState(false);
  const dragging = useRef(false);
  const clickTimer = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const holdShown = useRef(false);
  const pointerType = useRef('mouse');
  const suppressClick = useRef(false);
  const stopTracking = useRef<(() => void) | null>(null);
  const handlers = useRef({ onInspect, onDragMove, onDragEnd, onDragCancel, onZoom, onPreview });
  handlers.current = { onInspect, onDragMove, onDragEnd, onDragCancel, onZoom, onPreview };

  const clearHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const scheduleZoom = () => {
    clearHold();
    holdShown.current = false;
    holdTimer.current = window.setTimeout(() => {
      if (dragging.current) return;
      holdShown.current = true;
      if (pointerType.current === 'mouse') handlers.current.onZoom?.(card);
      else { suppressClick.current = true; handlers.current.onPreview?.(card); }
    }, 750);
  };
  const cancelZoom = () => {
    clearHold();
    holdShown.current = false;
    handlers.current.onZoom?.(null);
  };
  useEffect(() => () => { stopTracking.current?.(); clearHold(); if (clickTimer.current) window.clearTimeout(clickTimer.current); }, []);
  useEffect(() => setFailed(false), [card.imageName, card.name, card.faceIndex]);

  function pointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    pointerType.current = event.pointerType;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopTracking.current?.();
    suppressClick.current = false;
    dragging.current = false;
    holdShown.current = false;
    if (event.pointerType !== 'mouse') scheduleZoom();
    const pointerId = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY };
    let scrolling = false;
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId || holdShown.current || scrolling) return;
      const dx = pointer.clientX - origin.x;
      const dy = pointer.clientY - origin.y;
      if (!dragging.current && Math.hypot(dx, dy) < dragThreshold) return;
      clearHold();
      if (!dragging.current && scrollable && event.pointerType !== 'mouse' && Math.abs(dx) > Math.abs(dy)) {
        scrolling = true;
        suppressClick.current = true;
        return;
      }
      if (!draggable) { suppressClick.current = true; return; }
      dragging.current = true;
      handlers.current.onZoom?.(null);
      handlers.current.onDragMove(card, pointer.clientX, pointer.clientY);
    };
    const up = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      cleanup();
      clearHold();
      if (holdShown.current || scrolling) suppressClick.current = true;
      const moved = dragging.current;
      dragging.current = false;
      if (!moved) return;
      suppressClick.current = true;
      handlers.current.onDragEnd(card, pointer.clientX, pointer.clientY);
    };
    const cancel = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      suppressClick.current = true;
      stopTracking.current?.();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      stopTracking.current = null;
    };
    stopTracking.current = () => {
      cleanup();
      clearHold();
      if (dragging.current) handlers.current.onDragCancel();
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  return <button
    type="button"
    className={`playing-card ${draggable ? 'can-drag' : ''} ${card.tapped ? 'is-tapped' : ''} ${card.faceDown ? 'is-face-down' : ''} ${selected ? 'is-selected' : ''}`}
    style={{ touchAction: scrollable ? 'pan-x' : undefined }}
    onContextMenu={event => event.preventDefault()}
    aria-label={card.name || 'Carta face para baixo'}
    data-card-id={card.id}
    data-tapped={Boolean(card.tapped)}
    data-face-down={Boolean(card.faceDown)}
    onPointerDown={pointerDown}
    onPointerEnter={event => { if (event.pointerType === 'mouse') { pointerType.current = 'mouse'; onHover?.(card); scheduleZoom(); } }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') cancelZoom(); }}
    onFocus={() => onHover?.(card)}
    onBlur={cancelZoom}
    onDoubleClick={() => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      if (draggable && card.zone === 'battlefield' && pointerType.current === 'mouse') onToggleTapped?.(card);
    }}
    onClick={event => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      if (draggable && card.zone === 'battlefield' && pointerType.current === 'mouse' && event.detail > 0) {
        if (event.detail === 1) clickTimer.current = window.setTimeout(() => handlers.current.onInspect(card), 350);
      } else handlers.current.onInspect(card);
    }}
  >
    {card.faceDown || !card.name ? <span className="card-back">Face para baixo{card.revealed && <small>Revelada</small>}</span> : failed
      ? <span className="card-fallback">{card.name}</span>
      : <img src={cardImageURL(card)} alt="" draggable={false} onError={() => setFailed(true)} />}
    <CardStats {...card} />
  </button>;
}
