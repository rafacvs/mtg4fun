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

export function shortcutCommand(event: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey'> & { shiftKey?: boolean }, editing: boolean) {
  return editing ? null : customizedShortcutCommand(event as KeyboardEvent, { ...shortcutDefaults });
}

export const shortcutDefaults = {
  draw: 'D', untap: 'U', turn: 'Space', previousTurn: 'Shift+Space', library: 'G', actions: 'R',
  token: 'F', life: 'V', emoji: 'E', help: 'K', hand: 'H', tap: 'T', inspect: 'I', destinations: 'M',
  nextPlayer: 'N', previousPlayer: 'Shift+N', ownField: 'B', overview: 'O', graveyard: 'J', exile: 'X', chat: 'Z', cycleZone: 'C',
} as const;

export type ShortcutBindings = Record<keyof typeof shortcutDefaults, string>;
const shortcutStorageKey = 'mtg4fun.match.shortcuts.v1';

export function readShortcutBindings(): ShortcutBindings {
  try {
    const raw = localStorage.getItem(shortcutStorageKey);
    if (!raw) return { ...shortcutDefaults };
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const candidate = { ...shortcutDefaults } as ShortcutBindings;
    for (const name of Object.keys(shortcutDefaults) as (keyof typeof shortcutDefaults)[]) {
      const value = saved[name];
      if (typeof value === 'string' && isValidShortcut(value)) candidate[name] = normalizeShortcut(value);
    }
    const values = Object.values(candidate).map(normalizeShortcut);
    if (new Set(values).size !== values.length) return { ...shortcutDefaults };
    return candidate;
  } catch { return { ...shortcutDefaults }; }
}

export function saveShortcutBindings(bindings: ShortcutBindings) {
  try { localStorage.setItem(shortcutStorageKey, JSON.stringify(bindings)); } catch { /* Private browsing or restricted storage: keep this session's settings. */ }
}

export function normalizeShortcut(value: string) { return value.trim().toUpperCase().replace(/\s+/g, ''); }
export function isValidShortcut(value: string) {
  const normalized = normalizeShortcut(value);
  return /^(SHIFT\+(SPACE|N)|SPACE|[A-Z0-9])$/.test(normalized) && !['TAB', 'ESC', 'ENTER'].includes(normalized);
}

const commandNames: Record<keyof typeof shortcutDefaults, string> = {
  draw: 'draw', untap: 'untap', turn: 'turn', previousTurn: 'turn-previous', library: 'library', actions: 'actions',
  token: 'token', life: 'life', emoji: 'emoji', help: 'shortcuts', hand: 'hand', tap: 'tap', inspect: 'inspect', destinations: 'destinations',
  nextPlayer: 'observe-next', previousPlayer: 'observe-previous', ownField: 'own-field', overview: 'overview', graveyard: 'graveyard', exile: 'exile', chat: 'chat', cycleZone: 'cycle-zone',
};

export function customizedShortcutCommand(event: KeyboardEvent, bindings: ShortcutBindings) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
  const pressed = event.key === ' ' ? `${event.shiftKey ? 'SHIFT+' : ''}SPACE` : `${event.shiftKey ? 'SHIFT+' : ''}${event.key.toUpperCase()}`;
  const entry = (Object.keys(bindings) as (keyof typeof shortcutDefaults)[]).find(name => normalizeShortcut(bindings[name]) === pressed);
  return entry ? commandNames[entry] : null;
}

export function isTextEntry(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

export function visibleCardButtons(zone: 'hand' | 'battlefield', playerId: number) {
  const selector = zone === 'hand' ? '.own-dock button.playing-card:not([disabled])' : `[data-field-owner="${playerId}"].zone-battlefield button.playing-card:not([disabled])`;
  return [...document.querySelectorAll<HTMLButtonElement>(`.match-board ${selector}`)]
    .filter(button => button.getClientRects().length > 0 && !button.closest('[hidden], [aria-hidden="true"]'));
}
