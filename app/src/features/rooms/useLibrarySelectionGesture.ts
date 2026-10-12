import { useRef, type PointerEvent } from 'react';

// Recognize stationary touches directly instead of depending on a synthetic
// click after a drag, without selecting during scrolling or
// toggling twice when the browser does also produce a click.
export function useLibrarySelectionGesture(busy: boolean, onSelect: (id: string) => void) {
  const touch = useRef<{ id: string; pointer: number; x: number; y: number } | null>(null);
  const handled = useRef('');
  return {
    start(event: PointerEvent<HTMLElement>, id: string) {
      handled.current = '';
      touch.current =
        !busy &&
        event.isPrimary &&
        event.pointerType === 'touch' &&
        !(event.target as HTMLElement).closest('button')
          ? { id, pointer: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
    },
    finish(event: PointerEvent<HTMLElement>, id: string) {
      const current = touch.current;
      touch.current = null;
      if (
        !busy &&
        current?.id === id &&
        current.pointer === event.pointerId &&
        Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5
      ) {
        handled.current = id;
        onSelect(id);
      }
    },
    cancel() {
      touch.current = null;
    },
    click(id: string) {
      if (handled.current === id) {
        handled.current = '';
        return;
      }
      if (!busy) onSelect(id);
    },
  };
}
