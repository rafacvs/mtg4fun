import { useEffect, useRef, useState, type PointerEvent } from 'react';

type Gesture = {
  id: string;
  pointer: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  moved: boolean;
  target: string;
};

// Pointer capture keeps the grip usable with mouse and touch, even outside the card.
// Commit only on release: the gesture never causes partial server-side reorders.
export function useLibraryDrag(
  busy: boolean,
  onReorder: (id: string, target: string) => Promise<void>,
) {
  const container = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState('');
  const [target, setTarget] = useState('');

  const cancel = () => {
    gesture.current = null;
    setDragging('');
    setTarget('');
  };
  const locate = (current: Gesture) => {
    const list = container.current;
    if (!list) return;
    const element = document
      .elementFromPoint(current.x, current.y)
      ?.closest<HTMLElement>('[data-library-card-id]');
    current.target =
      element && list.contains(element) && element.dataset.libraryCardId !== current.id
        ? (element.dataset.libraryCardId ?? '')
        : '';
    setTarget(current.target);
  };

  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const scroll = () => {
      const list = container.current;
      const current = gesture.current;
      if (list && current?.moved) {
        const rect = list.getBoundingClientRect();
        const speed = (position: number, start: number, end: number) =>
          position < start + 28 ? -8 : position > end - 28 ? 8 : 0;
        if (
          current.x >= rect.left - 28 &&
          current.x <= rect.right + 28 &&
          current.y >= rect.top - 28 &&
          current.y <= rect.bottom + 28
        ) {
          if (list.classList.contains('library-strip')) list.scrollLeft += speed(current.x, rect.left, rect.right);
          else list.scrollTop += speed(current.y, rect.top, rect.bottom);
          locate(current);
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    window.addEventListener('blur', cancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', cancel);
    };
  }, [dragging]);

  useEffect(() => {
    if (busy) cancel();
  }, [busy]);

  return {
    container,
    dragging,
    target,
    cancel,
    start(event: PointerEvent<HTMLButtonElement>, id: string) {
      event.stopPropagation();
      if (busy || !event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        id,
        pointer: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: '',
      };
    },
    move(event: PointerEvent<HTMLButtonElement>) {
      const current = gesture.current;
      if (!current || current.pointer !== event.pointerId) return;
      current.x = event.clientX;
      current.y = event.clientY;
      if (Math.hypot(current.x - current.originX, current.y - current.originY) >= 5)
        current.moved = true;
      if (current.moved) {
        setDragging(current.id);
        locate(current);
      }
    },
    finish(event: PointerEvent<HTMLButtonElement>) {
      const current = gesture.current;
      if (!current || current.pointer !== event.pointerId) return;
      locate(current);
      cancel();
      if (!busy && current.moved && current.target) void onReorder(current.id, current.target);
    },
  };
}
