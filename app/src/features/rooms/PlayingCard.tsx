import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cardImageURL } from './cardImage';
import { CardStats } from './CounterValues';
import type { Card } from './roomsApi';

const dragThreshold = 8;

type Props = {
  card: Card;
  draggable: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
  scrollable?: boolean;
  scrollAxis?: 'x' | 'y';
  onPreview?: (card: Card) => void;
  selected?: boolean;
  selectedIds?: string[];
  onInspect: (card: Card, additive?: boolean) => void;
  onOpenMenu?: (card: Card) => void;
  onHover?: (card: Card) => void;
  onZoom?: (card: Card | null) => void;
  onToggleTapped?: (card: Card) => void;
  onDragMove: (card: Card, x: number, y: number) => void;
  onDragEnd: (card: Card, x: number, y: number) => void;
  onDragCancel: () => void;
};

export function PlayingCard({ card, draggable, ariaLabel, style, scrollable = false, scrollAxis = 'x', onPreview, onInspect, onHover, onZoom, onDragMove, onDragEnd, onDragCancel, onToggleTapped, selected: explicitSelection, selectedIds, onOpenMenu }: Props) {
  const selected = explicitSelection ?? selectedIds?.includes(card.id);
  const [failed, setFailed] = useState(false);
  const dragging = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const clickTimer = useRef<number | null>(null);
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
    }, 375);
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
      if (!dragging.current && scrollable && event.pointerType !== 'mouse' && (scrollAxis === 'x' ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx))) {
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
      if (holdShown.current && pointerType.current !== 'mouse') ignoreHeldRelease();
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
    const secondTouch = (pointer: PointerEvent) => {
      if (pointer.pointerType !== 'touch' || pointer.pointerId === pointerId) return;
      suppressClick.current = true;
      stopTracking.current?.();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', secondTouch);
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
    window.addEventListener('pointerdown', secondTouch);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  return <button
    type="button"
    className={`playing-card ${draggable ? 'can-drag' : ''} ${card.tapped ? 'is-tapped' : ''} ${card.faceDown ? 'is-face-down' : ''} ${selected ? 'is-selected' : ''} ${card.ownerId !== card.controllerId ? 'borrowed-card' : ''} ${failed ? 'without-image' : ''} ${card.pending ? 'is-pending' : ''}`}
    style={{ ...style, touchAction: scrollable ? `pan-${scrollAxis}` : undefined, '--controller-color': `var(--seat-${card.controllerId}, var(--gold))` } as CSSProperties}
    onContextMenu={event => { event.preventDefault(); if (pointerType.current === 'mouse') onOpenMenu?.(card); }}
    aria-pressed={Boolean(selected)}
    aria-label={ariaLabel ?? (card.name || 'Carta face para baixo')}
    data-card-id={card.id}
    data-pending={Boolean(card.pending)}
    aria-busy={Boolean(card.pending)}
    data-tapped={Boolean(card.tapped)}
    data-face-down={Boolean(card.faceDown)}
    onPointerDown={pointerDown}
    onPointerEnter={event => { if (event.pointerType === 'mouse') { pointerType.current = 'mouse'; onHover?.(card); scheduleZoom(); } }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') cancelZoom(); }}
    onFocus={() => onHover?.(card)}
    onBlur={cancelZoom}
    onDoubleClick={() => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (draggable && card.zone === 'battlefield' && pointerType.current === 'mouse') onToggleTapped?.(card);
    }}
    onClick={event => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      if (event.detail > 1) return;
      const additive = event.shiftKey;
      if (pointerType.current === 'mouse' && event.detail === 1 && !additive && draggable && card.zone === 'battlefield') {
        if (clickTimer.current) window.clearTimeout(clickTimer.current);
        clickTimer.current = window.setTimeout(() => { clickTimer.current = null; handlers.current.onInspect(card, additive); }, 250);
      } else handlers.current.onInspect(card, additive);
    }}
  >
    {card.faceDown || !card.name ? <span className="card-back">Face para baixo{card.revealed && <small>Revelada</small>}</span> : failed
      ? <span className="card-fallback">{card.name}</span>
      : <img src={cardImageURL(card)} alt="" draggable={false} onError={() => setFailed(true)} />}
    <span className="card-state-badges">
      {card.pending && <small>Pendente</small>}
      {(card.isToken || card.instanceKind === 'token' || card.instanceKind === 'custom-token') && <small>Ficha</small>}
      {card.instanceKind === 'copy' && <small>Cópia</small>}
      {(card.revealed || Boolean(card.revealedTo?.length)) && <small>Revelada</small>}
      {card.ownerId !== card.controllerId && <small title="Controlada por outro jogador">Controle</small>}
      {failed && <small>Sem imagem</small>}
    </span>
    <CardStats {...card} />
  </button>;
}

// The held card opens a surface under the finger. Its synthetic release click
// must not land on that surface's backdrop and immediately dismiss it. A new
// pointer-down clears the guard, so the next deliberate tap is never delayed.
function ignoreHeldRelease() {
  const clear = () => { window.removeEventListener('click', ignore, true); window.removeEventListener('pointerdown', clear, true); };
  const ignore = (event: MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation(); clear(); };
  window.addEventListener('click', ignore, { capture: true, once: true });
  window.addEventListener('pointerdown', clear, { capture: true, once: true });
  window.setTimeout(clear, 1000);
}
