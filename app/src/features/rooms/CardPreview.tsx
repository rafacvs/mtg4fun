import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import type { Card } from './roomsApi';

export function CardPreview({ card, onClose, viewerId, disabled, onStateChange }: { card: Card | null; onClose: () => void; viewerId?: number; disabled?: boolean; onStateChange?: CardStateChange }) {
  const imageName = card?.faces?.[card.faceIndex ?? 0] || card?.name || '';
  const closeRef = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [imageName]);

  useEffect(() => {
    if (!card) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card?.id, onClose]);

  if (!card) return null;
  return <div className="card-preview-backdrop" onClick={onClose}>
    <div className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name || 'Carta face para baixo'}`} onClick={event => event.stopPropagation()}>
      <header>
        <h2>{card.name || 'Carta face para baixo'}</h2>
        <button ref={closeRef} type="button" onClick={onClose}>Fechar</button>
      </header>
      {!card.name ? <p>Face para baixo · identidade oculta.</p> : failed
        ? <p role="status">A imagem não está disponível agora.</p>
        : <img src={deckApi.imageURL(imageName)} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
      {viewerId && onStateChange && <CardStateControls card={card} viewerId={viewerId} disabled={Boolean(disabled)} onChange={onStateChange} />}
    </div>
  </div>;
}
