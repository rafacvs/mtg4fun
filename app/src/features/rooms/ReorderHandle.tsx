import type { useLibraryDrag } from './useLibraryDrag';

// Dragging moves the card; the arrow keys step it towards a neighbour.
export function ReorderHandle({ name, id, busy, drag, onStep }: {
  name: string; id: string; busy: boolean; drag: ReturnType<typeof useLibraryDrag>; onStep: (offset: -1 | 1) => void;
}) {
  return (
    <button
      className="library-drag-handle"
      aria-label={`Reordenar ${name}`}
      title="Arraste para reordenar. No teclado, use as teclas de direção."
      disabled={busy}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => drag.start(event, id)}
      onPointerMove={drag.move}
      onPointerUp={drag.finish}
      onPointerCancel={drag.cancel}
      onLostPointerCapture={drag.cancel}
      onKeyDown={(event) => {
        event.stopPropagation();
        const offset = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
        if (!offset) return;
        event.preventDefault();
        if (!busy) onStep(offset);
      }}
    >
      <svg viewBox="0 0 16 24" width="16" height="24" aria-hidden="true">
        {[6, 12, 18].flatMap((y) => [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}
      </svg>
    </button>
  );
}
