import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';

export function CardPreview({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [card]);

  useEffect(() => {
    if (!card) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  if (!card) return null;
  return <div className="card-preview-backdrop" onClick={onClose}>
    <div className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name}`} onClick={event => event.stopPropagation()}>
      <header>
        <h2>{card.name}</h2>
        <button ref={closeRef} type="button" onClick={onClose}>Fechar</button>
      </header>
      {failed
        ? <p role="status">A imagem não está disponível agora.</p>
        : <img src={deckApi.imageURL(card.name)} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
    </div>
  </div>;
}
