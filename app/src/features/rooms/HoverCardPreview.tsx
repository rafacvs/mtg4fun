import { useState } from 'react';
import { cardImageURL } from './cardImage';
import type { Card } from './roomsApi';

export function HoverCardPreview({ card }: { card: Card | null }) {
  const image = card?.name ? cardImageURL(card) : '';
  return <section id="hover-card-preview" className={`hover-card-preview ${!card ? 'is-empty' : ''}`} aria-label="Prévia da carta">
    <h2>{card ? card.name || 'Carta face para baixo' : 'Prévia da carta'}</h2>
    {!card ? <p>Passe o mouse sobre uma carta para ampliá-la.</p>
      : !card.name ? <p>Face para baixo · identidade oculta.</p>
        : <HoverImage key={image} image={image} card={card} />}
  </section>;
}

function HoverImage({ image, card }: { image: string; card: Card }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="hover-card-fallback"><p>A imagem não está disponível agora.</p>{card.text && <p>{card.text}</p>}</div>
    : <img src={image} alt={`Prévia de ${card.name}`} onError={() => setFailed(true)} />;
}
