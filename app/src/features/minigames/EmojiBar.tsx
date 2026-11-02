import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { TableIcon } from '../rooms/TableIcon';
import './emoji.css';
import { EmojiPicker } from './EmojiPicker';
import { hasTableCards, TomatoAim, TomatoSplats } from './TomatoThrow';
import { pinnedEmojis, useEmojiReactions } from './useEmojiReactions';

export function EmojiBar() {
  const { drops, splats, waiting, secondsLeft, error, setError, send, throwTomato, remove, clean } = useEmojiReactions();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiming, setAiming] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (bar.current?.contains(target) || picker.current?.contains(target)) return;
      setOpen(false); setPickerOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const closePicker = useCallback(() => { setPickerOpen(false); more.current?.focus(); }, []);
  const stopAiming = useCallback(() => setAiming(false), []);
  const thrower = useRef(throwTomato);
  thrower.current = throwTomato;
  const aimAt = useCallback((cardId: string) => { void thrower.current(cardId); }, []);
  // Botão direito no tomate: o cursor vira alvo e cada carta clicada leva um tomate, até outro botão direito.
  const aim = () => {
    if (!hasTableCards()) { setError('Não há cartas no campo para acertar.'); return; }
    setError(''); setOpen(false); setPickerOpen(false); setAiming(true);
  };
  return <>
    <div ref={bar} className="emoji-bar" role="toolbar" aria-label="Reações">
      {open && <div className="emoji-tray" role="group" aria-label="Escolha um emoji">
        {waiting && <span className="emoji-wait" role="status">⧗ Calma… {Math.max(secondsLeft, 1)}s</span>}
        {error && <p role="alert" className="emoji-error">{error}</p>}
        {pinnedEmojis.map(emoji => <button type="button" key={emoji} className="emoji-option" aria-label={`Enviar ${emoji}`} title={emoji === '🍅' ? 'Botão direito: tacar numa carta' : undefined} disabled={waiting} onClick={() => void send(emoji)} onContextMenu={emoji === '🍅' ? event => { event.preventDefault(); aim(); } : undefined}>{emoji}</button>)}
        <button ref={more} type="button" className="emoji-option emoji-more" aria-label="Todos os emojis" aria-expanded={pickerOpen} onClick={() => setPickerOpen(value => !value)}><TableIcon name="search-plus" /></button>
      </div>}
      <button type="button" className={`emoji-toggle ${waiting ? 'is-cooling' : ''}`} aria-label="Reagir com emoji" aria-expanded={open} onClick={() => { setOpen(value => !value); setPickerOpen(false); }}><span aria-hidden="true">😂</span><TableIcon name="chevron" /></button>
    </div>
    {open && pickerOpen && <EmojiPicker anchor={more} panel={picker} disabled={waiting} onPick={emoji => void send(emoji)} onClose={closePicker} />}
    {aiming && <TomatoAim waitSeconds={waiting ? Math.max(secondsLeft, 1) : 0} onThrow={aimAt} onCancel={stopAiming} />}
    <TomatoSplats splats={splats} onDone={clean} />
    {createPortal(<div className="emoji-rain" aria-hidden="true">{drops.map(drop => <span key={drop.key} className="emoji-drop" style={{ left: `${drop.left}%`, animationDuration: `${drop.duration}ms` } as CSSProperties} onAnimationEnd={() => remove(drop.key)}><b>{drop.emoji}</b><small>{drop.fromName}</small></span>)}</div>, document.body)}
  </>;
}
