import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { MarkerRows, PowerToughnessAdjust, type CounterOperation } from './CounterControls';
import { CardStats } from './CounterValues';
import type { Card, MarkerColor } from './roomsApi';

type Step = 'view' | 'markers';
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;

export function CardPreview({ card, editable, disabled, onCounter, onClose }: { card: Card | null; editable: boolean; disabled: boolean; onCounter: CardCounter; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('view');
  const cardId = card?.id ?? null;
  const opened = cardId ? `${cardId}:${step}` : '';

  useEffect(() => { setFailed(false); }, [cardId]);
  useEffect(() => { setStep('view'); }, [cardId]);

  // Foca o fechar só quando a tela abre. O polling e uma nova identidade de onClose não recentram o foco.
  useEffect(() => {
    if (!opened) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  if (!card) return null;
  const title = step === 'markers' ? 'Marcador' : card.name;
  const back = () => setStep('view');
  return <div className="card-preview-backdrop" onClick={onClose}>
    <div className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name}`} onClick={event => event.stopPropagation()}>
      <header>
        {step !== 'view' && <button type="button" className="secondary panel-back" onClick={back}>Voltar</button>}
        <h2>{title}</h2>
        <button ref={closeRef} type="button" className="panel-close" onClick={onClose}>Fechar</button>
      </header>
      {step === 'view' && <>
        {failed
          ? <p role="status">A imagem não está disponível agora.</p>
          : <img src={deckApi.imageURL(card.name)} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
        <CardStats power={card.power} toughness={card.toughness} markers={card.markers} />
        {editable && <PowerToughnessAdjust power={card.power ?? 0} toughness={card.toughness ?? 0} disabled={disabled} onApply={(subject, operation, value) => onCounter(subject, operation, value)} />}
        {editable && <button type="button" disabled={disabled} onClick={() => setStep('markers')}>Marcador</button>}
      </>}
      {step === 'markers' && editable && <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter('marker', operation, value, color)} />}
    </div>
  </div>;
}
