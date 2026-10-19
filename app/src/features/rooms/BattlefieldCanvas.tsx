import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Card } from './roomsApi';

type Point = { x: number; y: number };

export function BattlefieldCanvas({ cards, zoom, enabled, onSelectArea, children }: {
  cards: Card[];
  zoom: number;
  enabled: boolean;
  onSelectArea?: (cards: Card[]) => void;
  children: ReactNode;
}) {
  const [rectangle, setRectangle] = useState<{ start: Point; end: Point } | null>(null);
  const stopTracking = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  const current = useRef({ cards, onSelectArea });
  current.current = { cards, onSelectArea };
  useEffect(() => () => stopTracking.current?.(), []);

  return <div className="battlefield-canvas" data-battlefield-canvas data-zoom={zoom} onClick={event => {
    if ((event.target as Element).closest('.playing-card')) return;
    if (suppressClick.current) { suppressClick.current = false; return; }
    current.current.onSelectArea?.([]);
  }} onPointerDown={event => {
    suppressClick.current = false;
    if (!enabled || event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('.playing-card')) return;
    event.preventDefault();
    stopTracking.current?.();
    const canvas = event.currentTarget;
    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    const local = (point: Point) => {
      const box = canvas.getBoundingClientRect();
      return { x: (point.x - box.left) / zoom, y: (point.y - box.top) / zoom };
    };
    setRectangle({ start: local(start), end: local(start) });
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId === pointerId) setRectangle({ start: local(start), end: local({ x: pointer.clientX, y: pointer.clientY }) });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cleanup);
      setRectangle(null);
      stopTracking.current = null;
    };
    const up = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      const left = Math.min(start.x, pointer.clientX), right = Math.max(start.x, pointer.clientX);
      const top = Math.min(start.y, pointer.clientY), bottom = Math.max(start.y, pointer.clientY);
      if (right - left >= 4 || bottom - top >= 4) {
        suppressClick.current = true;
        const selected = new Set<string>();
        // Use rendered bounds: stacks, rotation, zoom and spacing can shift
        // the visible card away from its persisted reference coordinates.
        canvas.querySelectorAll<HTMLElement>('[data-card-id]').forEach(node => {
          const box = node.getBoundingClientRect();
          if (box.right >= left && box.left <= right && box.bottom >= top && box.top <= bottom) selected.add(node.dataset.cardId!);
        });
        current.current.onSelectArea?.(current.current.cards.filter(card => selected.has(card.id)));
      }
      cleanup();
    };
    const cancel = (pointer: PointerEvent) => { if (pointer.pointerId === pointerId) cleanup(); };
    stopTracking.current = cleanup;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cleanup);
  }}>
    {children}
    {rectangle && <span className="selection-rectangle" aria-hidden="true" style={{ left: Math.min(rectangle.start.x, rectangle.end.x), top: Math.min(rectangle.start.y, rectangle.end.y), width: Math.abs(rectangle.end.x - rectangle.start.x), height: Math.abs(rectangle.end.y - rectangle.start.y) }} />}
  </div>;
}
