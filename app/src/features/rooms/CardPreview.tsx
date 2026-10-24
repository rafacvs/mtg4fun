import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardImageURL } from './cardImage';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import { MarkerRows, PowerToughnessAdjust, type CounterOperation, type OwedPair } from './CounterControls';
import { CardStats } from './CounterValues';
import { CardControlTransfer, type OwnerDestination } from './CardControlTransfer';
import type { Card, Match, MarkerColor } from './roomsApi';
import { MenuItem, PanelFeedback, PanelHeader, usePanelFocus } from './TablePanel';
import { TableIcon, type TableIconName } from './TableIcon';

type Step = 'view' | 'markers' | 'move' | 'more';
const destinations: { value: string; title: string; icon: TableIconName }[] = [
  { value: 'battlefield', title: 'Campo', icon: 'focus' },
  { value: 'hand', title: 'Mão', icon: 'hand' },
  { value: 'graveyard', title: 'Cemitério', icon: 'graveyard' },
  { value: 'exile', title: 'Exílio', icon: 'exile' },
  { value: 'command', title: 'Comando', icon: 'crown' },
  { value: 'library-top', title: 'Grimório — topo', icon: 'library' },
  { value: 'library-bottom', title: 'Grimório — fundo', icon: 'library' },
];
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;

export function CardPreview({ readingActions = false, card, editable = false, disabled = false, onCounter, onClose, onHide, viewerId, onStateChange, onCopy, busy = false, error = '', unconfirmed = false, onRetry, players, onTransfer, onMoveToOwner, onMove }: {
  readingActions?: boolean;
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
  onMove?: (cardId: string, destination: string) => Promise<boolean>;
}) {
  const imageName = card?.faces?.[card.faceIndex ?? 0] || card?.imageName || card?.name || '';
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [failed, setFailed] = useState(false);
  const [keepRevealed, setKeepRevealed] = useState(false);
  const [step, setStep] = useState<Step>('view');
  const owedPair = useRef<OwedPair | null>(null);
  const owedCard = useRef(card?.id ?? null);
  if (owedCard.current !== (card?.id ?? null)) {
    owedCard.current = card?.id ?? null;
    owedPair.current = null;
  }
  onCloseRef.current = () => {
    if (busy) return;
    if (card?.revealed && card.controllerId === viewerId && !keepRevealed && onHide) {
      void onHide(card.id).then(ok => { if (ok) onClose(); });
    } else onClose();
  };
  const cardId = card?.id ?? null;
  usePanelFocus(panelRef, Boolean(cardId), () => onCloseRef.current());

  useEffect(() => { setFailed(false); }, [imageName]);
  useEffect(() => { setStep('view'); setKeepRevealed(false); }, [cardId]);
  useEffect(() => {
    if (!cardId || step === 'view') return;
    (panelRef.current?.querySelector<HTMLElement>('input, select') ?? panelRef.current?.querySelector<HTMLElement>('[aria-label="Voltar"]'))?.focus({ preventScroll: true });
  }, [cardId, step]);

  if (!card) return null;
  const title = { view: card.name || 'Carta face para baixo', markers: 'Marcadores', move: 'Mover para…', more: 'Outras ações' }[step];
  const zone = destinations.find(destination => destination.value === card.zone)?.title ?? 'Consulta do grimório';
  const controlled = card.controllerId === viewerId;
  const image = card.instanceKind || card.imageName ? cardImageURL(card) : deckApi.imageURL(imageName);
  return <div className="card-preview-backdrop" onClick={() => onCloseRef.current()}>
    <div ref={panelRef} className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name || 'Carta face para baixo'}`} onClick={event => event.stopPropagation()}>
      <div className="card-preview-image">
        {!card.name ? <p>Face para baixo · identidade oculta.</p> : failed
          ? <p role="status">A imagem não está disponível agora.</p>
          : <img src={image} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
      </div>
      <div className="card-preview-actions">
      <PanelHeader title={title} subtitle={step === 'view' ? zone : card.name || 'Carta face para baixo'} onClose={() => onCloseRef.current()} closeLabel="Fechar" onBack={step !== 'view' ? () => setStep('view') : undefined} />
      <PanelFeedback error={error} busy={busy} unconfirmed={Boolean(unconfirmed && onRetry)} onRetry={onRetry ?? (async () => false)} />
      {step === 'view' && <>
        {(card.tapped || (card.faceDown && Boolean(card.name)) || card.revealed) && <div className="card-status-chips">{card.tapped && <span>Virada</span>}{card.faceDown && card.name && <span>Face para baixo</span>}{card.revealed && <span className="is-public">Revelada para todos</span>}</div>}
        {card.text && <p className="instance-text">{card.text}</p>}
        <CardStats {...card} />
        {editable && onCounter && <PowerToughnessAdjust key={card.id} power={card.power ?? 0} toughness={card.toughness ?? 0} disabled={disabled} owed={owedPair} onApply={(subject, operation, value) => onCounter(subject, operation, value)} />}
        {controlled && <div className="card-quick-actions">
          {viewerId && onStateChange && card.zone === 'battlefield' && <CardStateControls mode="quick" card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} />}
          {onMove && <button className="secondary" disabled={disabled} onClick={() => setStep('move')}><TableIcon name="move" />Mover para…</button>}
        </div>}
        {readingActions && controlled && <div className="portrait-card-actions" role="group" aria-label="Ações da carta">
          {viewerId && onStateChange && card.zone === 'battlefield' && <button className="secondary" disabled={disabled} onClick={() => onStateChange('set_tapped', card, !card.tapped)}>{card.tapped ? 'Desvirar' : 'Virar'}</button>}
          {viewerId && onStateChange && <button className="secondary" disabled={disabled} onClick={() => onStateChange('reveal_cards', card, !card.revealed)}>{card.revealed ? 'Ocultar revelação' : 'Revelar para todos'}</button>}
          {card.ownerId === viewerId && onMove && destinations.filter(destination => destination.value !== card.zone).map(destination => <button key={destination.value} disabled={disabled} onClick={() => void onMove(card.id, destination.value)}>{destination.value === 'battlefield' ? 'Jogar no campo' : destination.title}</button>)}
          {card.ownerId !== viewerId && viewerId && players && onTransfer && onMoveToOwner && <CardControlTransfer key={card.id} card={card} players={players} viewerId={viewerId} disabled={disabled} onTransfer={onTransfer} onMoveToOwner={onMoveToOwner} />}
        </div>}
        <div className="table-menu">
          {editable && onCounter && <MenuItem icon="markers" title="Marcadores" description="Marcadores de cor desta carta" disabled={disabled} onClick={() => setStep('markers')} />}
          {(controlled || onCopy) && <MenuItem icon="actions" title="Outras ações" description="Revelação, faces, controle e cópias" onClick={() => setStep('more')} />}
        </div>
      </>}
      {step === 'markers' && editable && onCounter && <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter('marker', operation, value, color)} />}
      {step === 'move' && controlled && <div className="table-menu">
        {card.ownerId === viewerId && destinations.filter(destination => destination.value !== card.zone).map(destination => <MenuItem key={destination.value} icon={destination.icon} title={destination.title} disabled={disabled} onClick={() => { void onMove?.(card.id, destination.value).then(ok => { if (ok) setStep('view'); }); }} />)}
        {card.ownerId !== viewerId && viewerId && players && onTransfer && onMoveToOwner && <CardControlTransfer key={card.id} card={card} players={players} viewerId={viewerId} disabled={disabled} onTransfer={onTransfer} onMoveToOwner={onMoveToOwner} />}
      </div>}
      {step === 'more' && <div className="panel-form">
        {viewerId && onStateChange && <CardStateControls mode="other" card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} />}
        {card.revealed && controlled && onHide && <label className="keep-revealed"><input type="checkbox" checked={keepRevealed} onChange={event => setKeepRevealed(event.target.checked)} />Manter revelada ao fechar (até passar o turno)</label>}
        {viewerId && players && onTransfer && onMoveToOwner && <CardControlTransfer key={card.id} card={card} players={players} viewerId={viewerId} disabled={disabled} onTransfer={onTransfer} onMoveToOwner={onMoveToOwner} />}
        {onCopy && card.id && <MenuItem icon="copy" title="Criar cópia independente" description="Criar uma nova instância no seu campo" disabled={busy || disabled} onClick={() => onCopy(card.id)} />}
      </div>}
      </div>
    </div>
  </div>;
}
