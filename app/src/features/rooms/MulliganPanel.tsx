import { useEffect, useRef, useState } from 'react';
import type { Card } from './roomsApi';
import { cardImageURL } from './cardImage';
import { CardHoverZoom } from './HoverCardPreview';
import { TableIcon } from './TableIcon';
import './mulligan-panel.css';

const hoverDelay = 750;
const longPressDelay = 600;
const touchMoveThreshold = 8;

export function MulliganPanel({ open, cards, bottomCount, canMulliganAgain, busy, onMulligan, onKeep, onClose }: {
  open: boolean;
  cards: Card[];
  bottomCount: number;
  canMulliganAgain: boolean;
  busy: boolean;
  onMulligan: () => Promise<boolean>;
  onKeep: (bottomIDs: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [kept, setKept] = useState<string[]>([]);
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
  const [readingCard, setReadingCard] = useState<Card | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const touchOrigin = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const pointerType = useRef('mouse');
  const cancelZoom = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setZoomedCard(null);
  };
  const scheduleZoom = (card: Card) => {
    cancelZoom();
    hoverTimer.current = window.setTimeout(() => setZoomedCard(card), hoverDelay);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    touchOrigin.current = null;
  };
  const startLongPress = (event: React.PointerEvent<HTMLButtonElement>, toggle: () => void) => {
    pointerType.current = event.pointerType;
    suppressClick.current = false;
    cancelLongPress();
    if (event.pointerType === 'mouse' || !selectable || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchOrigin.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      touchOrigin.current = null;
      suppressClick.current = true;
      setReadingCard(null);
      toggle();
    }, longPressDelay);
  };
  const moveLongPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = touchOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > touchMoveThreshold) cancelLongPress();
  };
  useEffect(() => { if (open) setKept([]); }, [open, cards.map(card => card.id).join('|')]);
  useEffect(() => () => { if (hoverTimer.current) window.clearTimeout(hoverTimer.current); if (longPressTimer.current) window.clearTimeout(longPressTimer.current); }, []);
  useEffect(() => {
    if (!open) { cancelZoom(); setReadingCard(null); return; }
    panel.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, onClose]);
  if (!open) return null;
  const selectable = bottomCount > 0;
  const valid = !selectable || kept.length === bottomCount;
  return <div className="mulligan-backdrop" onClick={onClose}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Escolher mão do mulligan" className="mulligan-panel" onClick={event => event.stopPropagation()}>
      <header><div><p className="eyebrow">MULLIGAN</p><h2>{selectable ? `Escolha ${bottomCount} carta${bottomCount === 1 ? '' : 's'} para o fundo` : 'Confira sua nova mão'}</h2><p>{selectable ? 'As cartas não selecionadas permanecerão na sua mão.' : 'Você pode manter esta mão ou embaralhar e comprar sete novamente.'}</p></div><button className="secondary icon-button" aria-label="Voltar à mesa" onClick={onClose}><TableIcon name="close" /></button></header>
      <div className="mulligan-cards" aria-label="Cartas da nova mão">{cards.map(card => {
        const selected = kept.includes(card.id);
        const toggle = () => setKept(current => current.includes(card.id) ? current.filter(id => id !== card.id) : current.length < bottomCount ? [...current, card.id] : current);
        return <button key={card.id} type="button" className={`mulligan-card ${selected ? 'is-kept' : ''}`} aria-pressed={selected} disabled={busy} data-card-id={card.id} onPointerDown={event => startLongPress(event, toggle)} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerEnter={event => { if (event.pointerType === 'mouse') scheduleZoom(card); }} onPointerLeave={event => { if (event.pointerType === 'mouse') cancelZoom(); }} onContextMenu={event => { if (pointerType.current !== 'mouse') event.preventDefault(); }} onFocus={() => setZoomedCard(card)} onBlur={cancelZoom} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (pointerType.current === 'mouse') { if (selectable) toggle(); } else setReadingCard(card); }}>
          <img src={cardImageURL(card)} alt="" /><span>{selected ? 'Enviar ao fundo' : card.name}</span>
        </button>;
      })}</div>
      <footer><span>{selectable ? `${kept.length} de ${bottomCount} selecionada(s) para o fundo` : `${cards.length} cartas`}</span><div><button className="secondary" disabled={busy || !canMulliganAgain} title={canMulliganAgain ? undefined : 'Limite atingido: mantenha uma carta'} onClick={() => void onMulligan().then(ok => { if (ok) setKept([]); })}>Mulligan novamente</button><button disabled={busy || !valid} onClick={() => void onKeep(kept)}>Manter mão</button></div></footer>
      {zoomedCard && <CardHoverZoom card={zoomedCard} />}
      {readingCard && <MulliganCardReader card={readingCard} selected={kept.includes(readingCard.id)} selectable={selectable} busy={busy} onToggle={() => setKept(current => current.includes(readingCard.id) ? current.filter(id => id !== readingCard.id) : current.length < bottomCount ? [...current, readingCard.id] : current)} onClose={() => setReadingCard(null)} />}
    </section>
  </div>;
}

function MulliganCardReader({ card, selected, selectable, busy, onToggle, onClose }: { card: Card; selected: boolean; selectable: boolean; busy: boolean; onToggle: () => void; onClose: () => void }) {
  return <div className="mulligan-reader-backdrop" onClick={onClose}>
    <section className="mulligan-reader" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name}`} onClick={event => event.stopPropagation()}>
      <header><h2 title={card.name}>{card.name}</h2><button type="button" className="secondary icon-button" aria-label="Fechar leitura da carta" onClick={onClose}><TableIcon name="close" /></button></header>
      <img src={cardImageURL(card)} alt={`Imagem ampliada de ${card.name}`} />
      {card.text && <p>{card.text}</p>}
      {selectable && <button type="button" disabled={busy} onClick={() => { onToggle(); onClose(); }}>{selected ? 'Manter na mão' : 'Enviar ao fundo'}</button>}
    </section>
  </div>;
}
