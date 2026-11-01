import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { TableIcon } from '../rooms/TableIcon';
import './emoji.css';
import { emojiOptions, useEmojiReactions } from './useEmojiReactions';

export function EmojiBar() {
  const { drops, waiting, secondsLeft, error, send, remove } = useEmojiReactions();
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
      {open && <div className="emoji-tray" role="group" aria-label="Escolha um emoji">
        {waiting && <span className="emoji-wait" role="status">⧗ Calma… {Math.max(secondsLeft, 1)}s</span>}
        {error && <p role="alert" className="emoji-error">{error}</p>}
        {emojiOptions.map(emoji => <button type="button" key={emoji} className="emoji-option" aria-label={`Enviar ${emoji}`} disabled={waiting} onClick={() => void send(emoji)}>{emoji}</button>)}
      </div>}
      <button type="button" className={`emoji-toggle ${waiting ? 'is-cooling' : ''}`} aria-label="Reagir com emoji" aria-expanded={open} onClick={() => setOpen(value => !value)}><span aria-hidden="true">😂</span><TableIcon name="chevron" /></button>
    </div>
    {createPortal(<div className="emoji-rain" aria-hidden="true">{drops.map(drop => <span key={drop.key} className="emoji-drop" style={{ left: `${drop.left}%`, animationDuration: `${drop.duration}ms` } as CSSProperties} onAnimationEnd={() => remove(drop.key)}><b>{drop.emoji}</b><small>{drop.fromName}</small></span>)}</div>, document.body)}
  </>;
}
