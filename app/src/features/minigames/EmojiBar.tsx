import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './emoji.css';
import { emojiOptions, useEmojiReactions } from './useEmojiReactions';

export function EmojiBar() {
  const { drops, cooling, error, send, remove } = useEmojiReactions();
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!bar.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <>
    <div ref={bar} className="emoji-bar" role="toolbar" aria-label="Reações">
      {error && <p role="alert" className="emoji-error">{error}</p>}
      {open && <div className="emoji-tray" role="group" aria-label="Escolha um emoji">
        {emojiOptions.map(emoji => <button type="button" key={emoji} className="emoji-option" aria-label={`Enviar ${emoji}`} disabled={cooling} onClick={() => void send(emoji)}>{emoji}</button>)}
      </div>}
      <button type="button" className={`emoji-toggle ${cooling ? 'is-cooling' : ''}`} aria-label="Reagir com emoji" aria-expanded={open} onClick={() => setOpen(value => !value)}>😀</button>
    </div>
    {createPortal(<div className="emoji-rain" aria-hidden="true">{drops.map(drop => <span key={drop.key} className="emoji-drop" style={{ left: `${drop.left}%`, animationDuration: `${drop.duration}ms` } as CSSProperties} onAnimationEnd={() => remove(drop.key)}><b>{drop.emoji}</b><small>{drop.fromName}</small></span>)}</div>, document.body)}
  </>;
}
