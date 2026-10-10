import { useState } from 'react';
import { deckApi, type DeckCard } from './deckApi';

export function useCardInspection() {
  const [card, setCard] = useState<DeckCard | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  function inspect(next: DeckCard) {
    setCard(next);
    setImageFailed(false);
  }

  function close() {
    setCard(null);
  }

  return {
    card,
    imageFailed,
    imageURL: card ? deckApi.imageURL(card.name) : '',
    inspect,
    close,
    reportImageFailure: () => setImageFailed(true),
  };
}
