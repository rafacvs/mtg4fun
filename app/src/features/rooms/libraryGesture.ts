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
  const commands = { d: 'draw', u: 'untap', n: 'turn', t: 'tap', h: 'hand', g: 'graveyard', e: 'exile', '+': 'marker', r: 'random', f: 'token' } as const;
  return commands[event.key.toLowerCase() as keyof typeof commands] ?? null;
}
