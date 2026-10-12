import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { MarkerPalette, QuantityAdjust, markerName, markerValue, type CounterOperation } from './CounterControls';
import { CardStats } from './CounterValues';
import type { Card, MarkerColor } from './roomsApi';

type Step = 'view' | 'power' | 'markers' | 'color';
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;

export function CardPreview({ card, editable, disabled, onCounter, onClose }: { card: Card | null; editable: boolean; disabled: boolean; onCounter: CardCounter; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('view');
  const [color, setColor] = useState<MarkerColor | null>(null);
  const cardId = card?.id ?? null;
  const opened = cardId ? `${cardId}:${step}:${color ?? ''}` : '';

  useEffect(() => { setFailed(false); }, [cardId]);
  useEffect(() => { setStep('view'); setColor(null); }, [cardId]);

  // Foca o fechar só quando a tela abre. O polling e uma nova identidade de onClose não recentram o foco.
  useEffect(() => {
    if (!opened) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  if (!card) return null;
  const title = step === 'power' ? 'Poder e resistência' : step === 'markers' ? 'Marcador' : step === 'color' && color ? `Marcador ${markerName(color)}` : card.name;
  const back = () => {
    if (step === 'color') { setStep('markers'); setColor(null); return; }
    setStep('view');
    setColor(null);
  };
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
        {editable && <div className="actions-grid">
          <button type="button" disabled={disabled} onClick={() => setStep('power')}>Poder e resistência</button>
          <button type="button" disabled={disabled} onClick={() => setStep('markers')}>Marcador</button>
        </div>}
      </>}
      {step === 'power' && editable && <div className="adjust-pair">
        <div role="group" aria-label="Poder">
          <h3>Poder</h3>
          <QuantityAdjust label="poder" value={card.power ?? 0} disabled={disabled} onApply={(operation, value) => onCounter('power', operation, value)} />
        </div>
        <div role="group" aria-label="Resistência">
          <h3>Resistência</h3>
          <QuantityAdjust label="resistência" value={card.toughness ?? 0} disabled={disabled} onApply={(operation, value) => onCounter('toughness', operation, value)} />
        </div>
      </div>}
      {step === 'markers' && editable && <MarkerPalette markers={card.markers} disabled={disabled} onPick={next => { setColor(next); setStep('color'); }} />}
      {step === 'color' && editable && color && <QuantityAdjust label={`marcador ${markerName(color)}`} value={markerValue(card.markers, color)} disabled={disabled} onApply={(operation, value) => onCounter('marker', operation, value, color)} />}
    </div>
  </div>;
}
