import { useEffect, useRef } from 'react';

// Preserve normal keyboard navigation inside dialogs and other editors.
export function useChatShortcut(enabled: boolean, toggle: () => void) {
  const latest = useRef(toggle);
  latest.current = toggle;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.repeat || document.querySelector('[role="dialog"], dialog[open]')) return;
      if (target?.closest('input, textarea, select, [contenteditable], [role="textbox"]') && !target.closest('.match-chat')) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
