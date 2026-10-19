import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardImageURL } from './cardImage';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import { MarkerRows, PowerToughnessAdjust, type CounterOperation } from './CounterControls';
import { CardStats } from './CounterValues';
import { CardControlTransfer, type OwnerDestination } from './CardControlTransfer';
import type { Card, Match, MarkerColor } from './roomsApi';

type Step = 'view' | 'markers';
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;

export function CardPreview({ card, editable = false, disabled = false, onCounter, onClose, onHide, viewerId, onStateChange, onCopy, busy = false, error = '', unconfirmed = false, onRetry, players, onTransfer, onMoveToOwner }: {
  card: Card | null;
  editable?: boolean;
  disabled?: boolean;
  onCounter?: CardCounter;
  onClose: () => void;
  onHide?: (id: string) => Promise<boolean>;
  viewerId?: number;
  onStateChange?: CardStateChange;
  onCopy?: (id: string) => void;
  busy?: boolean;
  error?: string;
  unconfirmed?: boolean;
  onRetry?: () => Promise<boolean>;
  players?: Match['players'];
  onTransfer?: (cardId: string, controllerId: number) => void;
  onMoveToOwner?: (cardId: string, destination: OwnerDestination) => void;
}) {
  const imageName = card?.faces?.[card.faceIndex ?? 0] || card?.imageName || card?.name || '';
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [failed, setFailed] = useState(false);
  const [keepRevealed, setKeepRevealed] = useState(false);
  const [step, setStep] = useState<Step>('view');
  onCloseRef.current = () => {
    if (busy) return;
    if (card?.revealed && card.controllerId === viewerId && !keepRevealed && onHide) {
      void onHide(card.id).then(ok => { if (ok) onClose(); });
    } else onClose();
  };
  const cardId = card?.id ?? null;
  const opened = cardId ? `${cardId}:${step}` : '';

  useEffect(() => { setFailed(false); }, [imageName]);
  useEffect(() => { setStep('view'); setKeepRevealed(false); }, [cardId]);

  useEffect(() => {
    if (!opened) return;
    const input = closeRef.current?.closest('[role="dialog"]')?.querySelector<HTMLInputElement>('input');
    if (input) input.focus(); else closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  if (!card) return null;
  const title = step === 'markers' ? 'Marcador' : (card.name || 'Carta face para baixo');
  const image = card.instanceKind || card.imageName ? cardImageURL(card) : deckApi.imageURL(imageName);
  return <div className="card-preview-backdrop" onClick={() => onCloseRef.current()}>
    <div className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name || 'Carta face para baixo'}`} onClick={event => event.stopPropagation()}>
      <div className="card-preview-image">
        {!card.name ? <p>Face para baixo · identidade oculta.</p> : failed
          ? <p role="status">A imagem não está disponível agora.</p>
          : <img src={image} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
      </div>
      <div className="card-preview-actions">
      <header>
        {step !== 'view' && <button type="button" className="secondary panel-back" onClick={() => setStep('view')}>Voltar</button>}
        <h2>{title}</h2>
        <button ref={closeRef} type="button" disabled={busy} className="panel-close" onClick={() => onCloseRef.current()}>Fechar</button>
      </header>
      {error && <p role="alert" className="error">{error}{unconfirmed && onRetry && <button disabled={busy} onClick={() => void onRetry()}>Tentar novamente</button>}</p>}
      {step === 'view' && <>
        {card.text && <p className="instance-text">{card.text}</p>}
        {!editable && <CardStats power={card.power} toughness={card.toughness} markers={card.markers} />}
        {editable && onCounter && <div className="card-toolbar">
          <PowerToughnessAdjust power={card.power ?? 0} toughness={card.toughness ?? 0} disabled={disabled} onApply={(subject, operation, value) => onCounter(subject, operation, value)} />
          <button type="button" className="secondary" disabled={disabled} onClick={() => setStep('markers')}>Marcador</button>
        </div>}
        {viewerId && onStateChange && <CardStateControls card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} />}
        {card.revealed && card.controllerId === viewerId && onHide && <label className="keep-revealed"><input type="checkbox" checked={keepRevealed} onChange={event => setKeepRevealed(event.target.checked)} />Manter revelada ao fechar (até passar o turno)</label>}
        {viewerId && players && onTransfer && onMoveToOwner && <CardControlTransfer key={card.id} card={card} players={players} viewerId={viewerId} disabled={disabled} onTransfer={onTransfer} onMoveToOwner={onMoveToOwner} />}
        {onCopy && card.id && <button type="button" disabled={busy || disabled} onClick={() => onCopy(card.id)}>Criar cópia independente</button>}
      </>}
      {step === 'markers' && editable && onCounter && <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter('marker', operation, value, color)} />}
      </div>
    </div>
  </div>;
}
