import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardImageURL } from './cardImage';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import { MarkerRows, PowerToughnessAdjust, type CounterOperation } from './CounterControls';
import { CardStats } from './CounterValues';
import type { Card, MarkerColor } from './roomsApi';

type Step = 'view' | 'markers';
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;

export function CardPreview({ card, editable = false, disabled = false, onCounter, onClose, viewerId, onStateChange, onCopy, busy = false }: {
  card: Card | null;
  editable?: boolean;
  disabled?: boolean;
  onCounter?: CardCounter;
  onClose: () => void;
  viewerId?: number;
  onStateChange?: CardStateChange;
  onCopy?: (id: string) => void;
  busy?: boolean;
}) {
  const imageName = card?.faces?.[card.faceIndex ?? 0] || card?.imageName || card?.name || '';
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('view');
  const cardId = card?.id ?? null;
  const opened = cardId ? `${cardId}:${step}` : '';

  useEffect(() => { setFailed(false); }, [imageName]);
  useEffect(() => { setStep('view'); }, [cardId]);

  useEffect(() => {
    if (!opened) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  if (!card) return null;
  const title = step === 'markers' ? 'Marcador' : (card.name || 'Carta face para baixo');
  const image = card.instanceKind || card.imageName ? cardImageURL(card) : deckApi.imageURL(imageName);
  return <div className="card-preview-backdrop" onClick={onClose}>
    <div className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name || 'Carta face para baixo'}`} onClick={event => event.stopPropagation()}>
      <header>
        {step !== 'view' && <button type="button" className="secondary panel-back" onClick={() => setStep('view')}>Voltar</button>}
        <h2>{title}</h2>
        <button ref={closeRef} type="button" className="panel-close" onClick={onClose}>Fechar</button>
      </header>
      {step === 'view' && <>
        {!card.name ? <p>Face para baixo · identidade oculta.</p> : failed
          ? <p role="status">A imagem não está disponível agora.</p>
          : <img src={image} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
        {card.text && <p className="instance-text">{card.text}</p>}
        {!editable && <CardStats power={card.power} toughness={card.toughness} markers={card.markers} />}
        {editable && onCounter && <div className="card-toolbar">
          <PowerToughnessAdjust power={card.power ?? 0} toughness={card.toughness ?? 0} disabled={disabled} onApply={(subject, operation, value) => onCounter(subject, operation, value)} />
          <button type="button" className="secondary" disabled={disabled} onClick={() => setStep('markers')}>Marcador</button>
        </div>}
        {viewerId && onStateChange && <CardStateControls card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} />}
        {onCopy && card.id && <button type="button" disabled={busy} onClick={() => onCopy(card.id)}>Criar cópia independente</button>}
      </>}
      {step === 'markers' && editable && onCounter && <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter('marker', operation, value, color)} />}
    </div>
  </div>;
}
