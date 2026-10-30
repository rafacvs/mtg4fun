import { useEffect, useRef, useState } from 'react';
import { cardImageURL } from './cardImage';
import { CardHoverZoom } from './HoverCardPreview';
import type { Card } from './roomsApi';
import { useLibraryDrag } from './useLibraryDrag';
import { useLibrarySelectionGesture } from './useLibrarySelectionGesture';

const hoverDelay = 450;

type Props = {
  cards: Card[];
  filtered: Card[];
  selectedIDs: string[];
  busy: boolean;
  onSelect: (id: string) => void;
  onInspect: (card: Card) => void;
  onReorder: (id: string, targetID: string) => Promise<void>;
};

function CardArt({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <span className="search-card-fallback">{card.name}</span>
    : <img src={cardImageURL(card)} alt="" draggable={false} onError={() => setFailed(true)} />;
}

export function LibrarySearchCards({ cards, filtered, selectedIDs, busy, onSelect, onInspect, onReorder }: Props) {
  const drag = useLibraryDrag(busy, onReorder);
  const selection = useLibrarySelectionGesture(busy, onSelect);
  const [zoomed, setZoomed] = useState<Card | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const stopHover = () => { window.clearTimeout(hoverTimer.current); setZoomed(null); };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  const position = (card: Card) => card.libraryPosition ?? cards.findIndex(item => item.id === card.id) + 1;
  const dragged = drag.dragging ? cards.find(card => card.id === drag.dragging) : undefined;
  const target = drag.target ? cards.find(card => card.id === drag.target) : undefined;
  return <div ref={drag.container} className="search-cards" aria-label="Cartas da consulta">
    {!filtered.length && <p className="library-empty">{cards.length ? 'Nenhuma carta com esses filtros.' : 'Todas as cartas foram movidas. Escolha como fechar a busca.'}</p>}
    {filtered.map(card => {
      const selected = selectedIDs.includes(card.id);
      const moving = drag.dragging === card.id;
      return <article
        key={card.id}
        data-library-card-id={card.id}
        data-card-id={card.id}
        className={`library-card search-card ${selected ? 'selected' : ''} ${moving ? 'dragging' : ''} ${drag.target === card.id ? 'drag-target' : ''}`}
        role="group"
        aria-label={`${card.name}, ${selected ? 'selecionada' : 'não selecionada'}`}
        aria-disabled={busy}
        tabIndex={busy ? -1 : 0}
        onClick={() => { if (!drag.consumeDrag()) selection.click(card.id); }}
        onContextMenu={event => { event.preventDefault(); stopHover(); onInspect(card); }}
        onPointerEnter={event => { if (event.pointerType !== 'mouse' || drag.dragging) return; window.clearTimeout(hoverTimer.current); hoverTimer.current = window.setTimeout(() => setZoomed(card), hoverDelay); }}
        onPointerLeave={stopHover}
        onPointerDown={event => { stopHover(); selection.start(event, card.id); drag.start(event, card.id); }}
        onPointerMove={drag.move}
        onPointerUp={event => { selection.finish(event, card.id); drag.finish(event); }}
        onPointerCancel={() => { selection.cancel(); drag.cancel(); }}
        onLostPointerCapture={drag.cancel}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || busy) return;
          const offset = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(card.id); }
          else if (offset) {
            event.preventDefault();
            const neighbour = cards[cards.findIndex(item => item.id === card.id) + offset];
            if (neighbour) void onReorder(card.id, neighbour.id);
          }
        }}
      >
        <div className="search-card-frame">
          {moving ? <span className="search-card-gap">vaga da posição {position(card)}</span> : <CardArt card={card} />}
          <b className="search-card-rank">{position(card)}</b>
          {selected && !moving && <span className="search-card-check" aria-hidden="true">✓</span>}
        </div>
        <strong>{card.name}</strong>
        <small>{card.revealed ? 'Todos veem' : card.type ?? ''}</small>
      </article>;
    })}
    {dragged && <div className="search-card-ghost" style={{ left: drag.point.x, top: drag.point.y }} aria-hidden="true">
      <div><CardArt card={dragged} /></div>
      {target && <span>soltar na posição {position(target)}</span>}
    </div>}
    {zoomed && !dragged && <CardHoverZoom card={zoomed} />}
  </div>;
}
