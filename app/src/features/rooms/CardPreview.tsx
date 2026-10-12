import { useEffect, useRef, useState } from 'react';
import { cardImageURL } from './cardImage';
import type { Card } from './roomsApi';

export function CardPreview({ card, onClose, onCopy, busy = false }: { card: Card | null; onClose: () => void; onCopy?: (id: string) => void; busy?: boolean }) {
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
        : <img src={cardImageURL(card)} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
      {card.text && <p className="instance-text">{card.text}</p>}
      {(card.power || card.toughness) && <p>{card.power || '—'} / {card.toughness || '—'}</p>}
      {onCopy && <button type="button" disabled={busy} onClick={() => onCopy(card.id)}>Criar cópia independente</button>}
    </div>
  </div>;
}
