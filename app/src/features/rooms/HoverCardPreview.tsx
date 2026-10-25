import { useLayoutEffect, useState } from 'react';
import { cardImageURL } from './cardImage';
import type { Card } from './roomsApi';

export function HoverCardPreview({ card }: { card: Card | null }) {
  const image = card?.name ? cardImageURL(card) : '';
  return <section id="hover-card-preview" className={`hover-card-preview ${!card ? 'is-empty' : ''}`} aria-label="Prévia da carta">
    <h2>{card ? card.name || 'Carta face para baixo' : 'Prévia da carta'}</h2>
    {!card ? <p>Segure uma carta para ler. No computador, passe o mouse sobre ela.</p>
      : !card.name ? <p>Face para baixo · identidade oculta.</p>
        : <><HoverImage key={image} image={image} card={card} />{card.text && <p className="preview-rules">{card.text}</p>}</>}
  </section>;
}

export function CardHoverZoom({ card }: { card: Card }) {
  const image = card.name ? cardImageURL(card) : '';
  const [failed, setFailed] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  useLayoutEffect(() => {
    const source = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(card.id)}"]`);
    if (source) {
      const box = source.getBoundingClientRect();
      setSide(box.left + box.width / 2 < window.innerWidth / 2 ? 'right' : 'left');
    }
  }, [card.id]);
  return <div className={`card-hover-zoom card-hover-zoom-${side}`} aria-hidden="true">
    {!card.name ? <p>Face para baixo</p>
      : failed || !image ? <p>{card.name}</p>
        : <img src={image} alt="" draggable={false} onError={() => setFailed(true)} />}
    {card.name && <p>{card.name}</p>}
  </div>;
}

function HoverImage({ image, card }: { image: string; card: Card }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="hover-card-fallback"><p>A imagem não está disponível agora.</p>{card.text && <p>{card.text}</p>}</div>
    : <img src={image} alt={`Prévia de ${card.name}`} onError={() => setFailed(true)} />;
}
