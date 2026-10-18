export function MatchLogCards({ cards = [], onPreview }: {
  cards?: { id: string; name: string }[];
  onPreview: (id: string) => void;
}) {
  if (!cards.length) return null;
  return <span className="log-cards"> · {cards.map((card, index) => <span key={card.id}>
    {index > 0 && ', '}
    <button type="button" className="log-card" aria-label={`Prévia de ${card.name} no registro`} onPointerEnter={event => { if (event.pointerType === 'mouse') onPreview(card.id); }} onFocus={() => onPreview(card.id)} onClick={() => onPreview(card.id)}>{card.name}</button>
  </span>)}</span>;
}
