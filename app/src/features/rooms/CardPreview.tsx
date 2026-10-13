import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardImageURL } from './cardImage';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import { MarkerRows, PowerToughnessAdjust, type CounterOperation } from './CounterControls';
import { CardStats } from './CounterValues';
import type { Card, MarkerColor } from './roomsApi';

type Step = 'view' | 'markers';
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;
type OwnerDestination = 'hand' | 'graveyard' | 'exile' | 'command' | 'library-top' | 'library-bottom';

function firstTarget(targets: { userId: number }[]) {
  return targets[0] ? String(targets[0].userId) : '';
}

export function CardPreview({ card, editable = false, disabled = false, onCounter, onClose, viewerId, onStateChange, onCopy, busy = false, transferTargets = [], ownerName, onTransfer, onMoveToOwner }: {
  card: Card | null;
  editable?: boolean;
  disabled?: boolean;
  onCounter?: CardCounter;
  onClose: () => void;
  viewerId?: number;
  onStateChange?: CardStateChange;
  onCopy?: (id: string) => void;
  busy?: boolean;
  transferTargets?: { userId: number; name: string }[];
  ownerName?: string;
  onTransfer?: (cardId: string, controllerId: number) => void;
  onMoveToOwner?: (cardId: string, destination: OwnerDestination) => void;
}) {
  const imageName = card?.faces?.[card.faceIndex ?? 0] || card?.imageName || card?.name || '';
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('view');
  const [ownerDestination, setOwnerDestination] = useState<OwnerDestination>('graveyard');
  const cardId = card?.id ?? null;
  const [trackedCardId, setTrackedCardId] = useState(cardId);
  const [transferTarget, setTransferTarget] = useState(() => firstTarget(transferTargets));
  if (cardId !== trackedCardId) {
    setTrackedCardId(cardId);
    setTransferTarget(firstTarget(transferTargets));
  }
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
        {card.zone === 'battlefield' && card.controllerId === viewerId && <section className="card-control-transfer" aria-label="Controle da carta">
          {transferTargets.length > 0 && onTransfer && <div>
            <label htmlFor={`transfer-target-${card.id}`}>Transferir controle para</label>
            <select id={`transfer-target-${card.id}`} disabled={disabled} value={transferTarget} onChange={event => setTransferTarget(event.target.value)}>{transferTargets.map(player => <option key={player.userId} value={player.userId}>{player.name}</option>)}</select>
            <button type="button" disabled={disabled || !transferTarget} onClick={() => onTransfer(card.id, Number(transferTarget))}>Transferir controle</button>
          </div>}
          {card.ownerId !== viewerId && ownerName && onMoveToOwner && <div>
            <label htmlFor={`owner-zone-${card.id}`}>Mover para zona de {ownerName}</label>
            <select id={`owner-zone-${card.id}`} disabled={disabled} value={ownerDestination} onChange={event => setOwnerDestination(event.target.value as OwnerDestination)}><option value="graveyard">Cemitério</option><option value="exile">Exílio</option><option value="command">Comando</option><option value="hand">Mão</option><option value="library-top">Grimório — topo</option><option value="library-bottom">Grimório — fundo</option></select>
            <button type="button" disabled={disabled} onClick={() => onMoveToOwner(card.id, ownerDestination)}>Mover para zona do dono</button>
          </div>}
        </section>}
        {onCopy && card.id && <button type="button" disabled={busy} onClick={() => onCopy(card.id)}>Criar cópia independente</button>}
      </>}
      {step === 'markers' && editable && onCounter && <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter('marker', operation, value, color)} />}
    </div>
  </div>;
}
