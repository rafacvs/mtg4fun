// A single click opens the menu; a double click cancels that pending opening.
// The short guard also suppresses repeated dblclick events from a rapid sequence.
export function createLibraryGesture(open: () => void, draw: () => void, delay = 350) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastDraw = -Infinity;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  return {
    cancel,
    click(detail: number) {
      cancel();
      if (detail === 0) open();
      else if (detail === 1) timer = setTimeout(open, delay);
    },
    doubleClick(now = Date.now()) {
      cancel();
      if (now - lastDraw < 450) return;
      lastDraw = now;
      draw();
    },
  };
}

export function shortcutCommand(event: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey'>, editing: boolean) {
  if (editing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
  return ({ d: 'draw', u: 'untap', n: 'turn', h: 'hide' } as const)[event.key.toLowerCase() as 'd' | 'u' | 'n' | 'h'] ?? null;
}
