import { useState } from 'react';
import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';
import { ReorderHandle } from './ReorderHandle';
import { useLibraryDrag } from './useLibraryDrag';
import { useLibrarySelectionGesture } from './useLibrarySelectionGesture';

type Props = {
  cards: Card[];
  filtered: Card[];
  selectedIDs: string[];
  busy: boolean;
  onSelect: (id: string) => void;
  onInspect: (card: Card) => void;
  onReorder: (id: string, targetID: string) => Promise<void>;
};

export function LibraryCards(props: Props) {
  const drag = useLibraryDrag(props.busy, props.onReorder);
  const selection = useLibrarySelectionGesture(props.busy, props.onSelect);
  return (
    <div
      ref={drag.container}
      className="library-cards library-strip"
      aria-label="Cartas da consulta"
    >
      {!props.filtered.length && (
        <p className="library-empty">
          {props.cards.length
            ? 'Nenhuma carta com esses filtros.'
            : 'Todas as cartas foram movidas. Finalize a consulta.'}
        </p>
      )}
      {props.filtered.map((card) => {
        const index = props.cards.findIndex((item) => item.id === card.id);
        const selected = props.selectedIDs.includes(card.id);
        return (
          <article
            key={card.id}
            data-library-card-id={card.id}
            className={`library-card ${selected ? 'selected' : ''} ${drag.dragging === card.id ? 'dragging' : ''} ${drag.target === card.id ? 'drag-target' : ''}`}
            role="group"
            aria-label={`${card.name}, ${selected ? 'selecionada' : 'não selecionada'}`}
            aria-disabled={props.busy}
            tabIndex={props.busy ? -1 : 0}
            onClick={() => selection.click(card.id)}
            onPointerDown={(event) => selection.start(event, card.id)}
            onPointerUp={(event) => selection.finish(event, card.id)}
            onPointerCancel={selection.cancel}
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !props.busy &&
                (event.key === 'Enter' || event.key === ' ')
              ) {
                event.preventDefault();
                props.onSelect(card.id);
              }
            }}
          >
            <ReorderHandle
              name={card.name}
              id={card.id}
              busy={props.busy}
              drag={drag}
              onStep={(offset) => {
                const target = props.cards[index + offset];
                if (target) void props.onReorder(card.id, target.id);
              }}
            />
            <CardImage card={card} onInspect={props.onInspect} />
            <div className="library-card-info">
              <span className="library-position">
                Posição {card.libraryPosition ?? index + 1}
                {(card.revealed || card.zone === 'revealed') && ' · Todos veem'}
              </span>
              <strong>{card.name}</strong>
              {card.type && <small className="library-type">{card.type}</small>}
              {selected && (
                <span className="library-selected-mark" aria-hidden="true">
                  ✓
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CardImage({ card, onInspect }: { card: Card; onInspect: (card: Card) => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="library-image"
      aria-label={`Ver imagem de ${card.name}`}
      onClick={(event) => {
        event.stopPropagation();
        onInspect(card);
      }}
    >
      {failed ? (
        <span className="library-card-fallback">{card.name}</span>
      ) : (
        <img
          src={deckApi.imageURL(card.faces?.[card.faceIndex ?? 0] || card.name)}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </button>
  );
}
