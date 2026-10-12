import { useState } from 'react';
import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';

type Props = {
  cards: Card[];
  filtered: Card[];
  selectedIDs: string[];
  searching: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onInspect: (card: Card) => void;
  onReorder: (id: string, targetID: string) => Promise<void>;
};

export function LibraryCards(props: Props) {
  const [dragging, setDragging] = useState('');
  return (
    <div
      className={`library-cards ${props.searching ? 'library-list' : 'library-strip'}`}
      aria-label="Cartas da consulta"
    >
      {!props.filtered.length && (
        <p className="library-empty">
          {props.cards.length
            ? 'Nenhuma carta com esse nome.'
            : 'Todas as cartas foram movidas. Finalize a consulta.'}
        </p>
      )}
      {props.filtered.map((card) => {
        const index = props.cards.findIndex((item) => item.id === card.id);
        return (
          <article
            key={card.id}
            className={`library-card ${props.selectedIDs.includes(card.id) ? 'selected' : ''}`}
            aria-label={card.name}
            draggable={!props.busy}
            onDragStart={() => setDragging(card.id)}
            onDragEnd={() => setDragging('')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!props.busy) {
                void props.onReorder(dragging, card.id);
                setDragging('');
              }
            }}
          >
            <CardSelection
              card={card}
              selected={props.selectedIDs.includes(card.id)}
              busy={props.busy}
              onSelect={props.onSelect}
            />
            <div className="library-card-info">
              <span className="library-position">
                {index + 1}
                {(card.revealed || card.zone === 'revealed') && ' · Todos veem'}
              </span>
              <strong>{card.name}</strong>
              <div className="library-card-controls">
                <button
                  className="secondary"
                  aria-label={`Antecipar ${card.name}`}
                  disabled={props.busy || index === 0}
                  onClick={() => void props.onReorder(card.id, props.cards[index - 1].id)}
                >
                  ←
                </button>
                <button
                  className="secondary"
                  aria-label={`Adiar ${card.name}`}
                  disabled={props.busy || index === props.cards.length - 1}
                  onClick={() => void props.onReorder(card.id, props.cards[index + 1].id)}
                >
                  →
                </button>
                <button
                  className="text-button"
                  aria-label={`Ampliar ${card.name}`}
                  onClick={() => props.onInspect(card)}
                >
                  Ampliar
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CardSelection({
  card,
  selected,
  busy,
  onSelect,
}: {
  card: Card;
  selected: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="library-select"
      aria-label={`Selecionar ${card.name}`}
      aria-pressed={selected}
      disabled={busy}
      onClick={() => onSelect(card.id)}
    >
      {failed ? (
        <span className="library-card-fallback">{card.name}</span>
      ) : (
        <img
          src={deckApi.imageURL(card.name)}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
      <span className="library-check" aria-hidden="true">
        {selected ? '✓' : '+'}
      </span>
    </button>
  );
}
