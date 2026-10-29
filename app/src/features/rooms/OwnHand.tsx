import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Card } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { PlayingCard } from './PlayingCard';

export function OwnHand({ cards = [], count, hoverZone, viewerId, gesture, scrollAxis = 'x', orientation, organizeEnabled = true }: { scrollAxis?: 'x' | 'y'; orientation?: 'portrait' | 'landscape'; organizeEnabled?: boolean; cards?: Card[]; count: number; hoverZone: string | null; viewerId: number; gesture: CardGesture }) {
  const row = useRef<HTMLDivElement>(null);
  const stopSelection = useRef<(() => void) | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [organizing, setOrganizing] = useState(false);
  useEffect(() => () => stopSelection.current?.(), []);
  useEffect(() => { if (scrollAxis !== 'y') setOrganizing(false); }, [scrollAxis]);
  useEffect(() => { setOrganizing(false); }, [orientation]);
  useEffect(() => { if (!organizeEnabled) setOrganizing(false); }, [organizeEnabled]);
  const [order, setOrder] = useState<string[]>([]);
  const ordered = [...cards].sort((a, b) => {
    const rank = (id: string) => order.includes(id) ? order.indexOf(id) : order.length + cards.findIndex(card => card.id === id);
    return rank(a.id) - rank(b.id);
  });
  const reorderAt = (card: Card, index: number) => {
    const ids = ordered.filter(item => item.id !== card.id).map(item => item.id);
    ids.splice(Math.max(0, index), 0, card.id);
    setOrder(ids);
  };
  return <section className={`table-zone zone-hand ${organizing ? 'is-organizing' : ''} ${hoverZone === 'hand' ? 'drop-hover' : ''}`} aria-label="Mão" data-drop-zone="hand">
    <header><span>Mão · {count}</span>{organizeEnabled && <button className="hand-organize secondary" aria-pressed={organizing} onClick={() => setOrganizing(value => !value)}>{organizing ? 'Concluir' : 'Organizar'}</button>}</header>
    <div ref={row} className="zone-cards hand-selection-canvas" tabIndex={0} aria-label="Cartas da mão" title={organizing ? 'Arraste ou use Alt + setas para ordenar uma carta focada' : 'Arraste no espaço vazio para selecionar várias cartas'} onPointerDown={event => {
      if (organizing || event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('.playing-card')) return;
      const canvas = event.currentTarget, pointerId = event.pointerId, start = { x: event.clientX, y: event.clientY };
      const draw = (x: number, y: number) => { const box = canvas.getBoundingClientRect(); setSelectionBox({ left: Math.min(start.x, x) - box.left + canvas.scrollLeft, top: Math.min(start.y, y) - box.top + canvas.scrollTop, width: Math.abs(x - start.x), height: Math.abs(y - start.y) }); };
      draw(start.x, start.y);
      const move = (pointer: PointerEvent) => { if (pointer.pointerId === pointerId) draw(pointer.clientX, pointer.clientY); };
      const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); setSelectionBox(null); stopSelection.current = null; };
      const up = (pointer: PointerEvent) => { if (pointer.pointerId !== pointerId) return; const left = Math.min(start.x, pointer.clientX), right = Math.max(start.x, pointer.clientX), top = Math.min(start.y, pointer.clientY), bottom = Math.max(start.y, pointer.clientY); if (right-left >= 4 || bottom-top >= 4) { const ids = new Set<string>(); canvas.querySelectorAll<HTMLElement>('[data-card-id]').forEach(node => { const box = node.getBoundingClientRect(); if (box.right >= left && box.left <= right && box.bottom >= top && box.top <= bottom) ids.add(node.dataset.cardId!); }); gesture.onSelectArea?.(cards.filter(card => ids.has(card.id))); } cleanup(); };
      const cancel = (pointer: PointerEvent) => { if (pointer.pointerId === pointerId) cleanup(); };
      stopSelection.current?.(); stopSelection.current = cleanup;
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    }} onKeyDown={event => {
      if (!organizing || !event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const id = (event.target as HTMLElement).closest('[data-card-id]')?.getAttribute('data-card-id');
      const index = ordered.findIndex(card => card.id === id);
      if (index < 0) return;
      event.preventDefault();
      reorderAt(ordered[index], Math.min(ordered.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
    }}>
      {ordered.map((card, index) => <PlayingCard style={{ '--fan-angle': `${Math.max(-7, Math.min(7, (index - (ordered.length - 1) / 2) * 2))}deg` } as CSSProperties} key={card.id} card={card} draggable={card.controllerId === viewerId} selected={gesture.selectedIds?.includes(card.id)} scrollable={!organizing} scrollAxis={scrollAxis} {...gesture} onDragMove={(card, x, y) => {
        const box = row.current?.getBoundingClientRect();
        if (box && organizing) {
          if (x < box.left + 32) row.current!.scrollLeft -= 12;
          if (x > box.right - 32) row.current!.scrollLeft += 12;
        }
        gesture.onDragMove(card, x, y);
      }} onDragEnd={(card, x, y) => {
        const destination = document.elementsFromPoint(x, y).map(node => node.closest('[data-drop-zone]')?.getAttribute('data-drop-zone')).find(Boolean);
        if (destination && destination !== 'hand') { gesture.onDragEnd(card, x, y); return; }
        const box = row.current?.getBoundingClientRect();
        if (box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
          const others = [...row.current!.querySelectorAll<HTMLElement>('[data-card-id]')].filter(node => node.dataset.cardId !== card.id);
          const index = others.findIndex(node => { const rect = node.getBoundingClientRect(); return x < rect.left + rect.width / 2; });
          reorderAt(card, index < 0 ? others.length : index);
          gesture.onDragCancel();
        } else gesture.onDragEnd(card, x, y);
      }} />)}
      {selectionBox && <span className="selection-rectangle" aria-hidden="true" style={selectionBox} />}
      {cards.length === 0 && <span className="zone-placeholder">Sua mão está vazia</span>}
    </div>
    <p className="hand-hint">{organizing ? 'Arraste para ordenar ou jogar' : 'Deslize para navegar · Segure para ler'}</p>
  </section>;
}
