import { useEffect } from 'react';

const holdDelay = 250;
function dispatch(action: 'open' | 'hold' | 'release') {
  document.dispatchEvent(new CustomEvent('mtg4fun:chat-shortcut', { detail: { action } }));
}

// The player board owns its configurable key binding; spectators use this Z bridge.
export function useChatShortcut(enabled: boolean, _legacyToggle?: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    let held = false;
    let armedPress = false;
    const clear = () => { window.clearTimeout(timer); timer = 0; };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key.toLowerCase() !== 'z' || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.isComposing || document.querySelector('[role="dialog"], dialog[open]')) return;
      if (target?.closest('input, textarea, select, [contenteditable], [role="textbox"]')) return;
      event.preventDefault();
      clear();
      held = false;
      armedPress = true;
      timer = window.setTimeout(() => { held = true; dispatch('hold'); }, holdDelay);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || !armedPress) return;
      clear();
      if (held) dispatch('release');
      else dispatch('open');
      held = false;
      armedPress = false;
    };
    const onBlur = () => { clear(); if (held) dispatch('release'); held = false; armedPress = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);
}
