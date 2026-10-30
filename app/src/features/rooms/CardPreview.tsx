import { useEffect, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardImageURL } from './cardImage';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import { markerColors, markerValue, MarkerRows, PowerToughnessAdjust, type CounterOperation, type OwedPair } from './CounterControls';
import { CardControlTransfer, type OwnerDestination } from './CardControlTransfer';
import type { Card, Match, MarkerColor } from './roomsApi';
import { PanelFeedback, PanelHeader, usePanelFocus } from './TablePanel';
import { TableIcon, type TableIconName } from './TableIcon';

type Step = 'view' | 'markers';
const destinations: { value: string; title: string; icon: TableIconName }[] = [
  { value: 'battlefield', title: 'Campo', icon: 'focus' },
  { value: 'hand', title: 'Mão', icon: 'hand' },
  { value: 'graveyard', title: 'Cemitério', icon: 'graveyard' },
  { value: 'exile', title: 'Exílio', icon: 'exile' },
  { value: 'library-top', title: 'Grimório — topo', icon: 'library' },
  { value: 'library-bottom', title: 'Grimório — fundo', icon: 'library' },
  { value: 'command', title: 'Comando', icon: 'crown' },
];
type CardCounter = (subject: 'power' | 'toughness' | 'marker', operation: CounterOperation, value: number, color?: MarkerColor) => Promise<boolean>;

export function CardPreview({ mobileSheet = false, card, editable = false, disabled = false, onCounter, onClose, onHide, viewerId, onStateChange, onCopy, onCreateToken, busy = false, error = '', unconfirmed = false, onRetry, players, onFocusOwner, onTransfer, onMoveToOwner, onMove }: {
  mobileSheet?: boolean;
  card: Card | null;
  editable?: boolean;
  disabled?: boolean;
  onCounter?: CardCounter;
  onClose: () => void;
  onHide?: (id: string) => Promise<boolean>;
  viewerId?: number;
  onStateChange?: CardStateChange;
  onCopy?: (id: string) => void;
  onCreateToken?: (name: string) => void;
  busy?: boolean;
  error?: string;
  unconfirmed?: boolean;
  onRetry?: () => Promise<boolean>;
  players?: Match['players'];
  onFocusOwner?: (ownerId: number) => void;
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
  const title = { view: card.name || 'Carta face para baixo', markers: 'Marcadores' }[step];
  const zone = destinations.find(destination => destination.value === card.zone)?.title ?? 'Consulta do grimório';
  const controlled = card.controllerId === viewerId;
  const activeMarkers = markerColors.filter(item => markerValue(card.markers, item.color) !== 0);
  const markerCount = activeMarkers.reduce((total, item) => total + markerValue(card.markers, item.color), 0);
  const image = card.instanceKind || card.imageName ? cardImageURL(card) : deckApi.imageURL(imageName);
  return <div className={`card-preview-backdrop ${mobileSheet ? 'mobile-card-sheet-backdrop' : ''}`} onClick={() => onCloseRef.current()}>
    <div ref={panelRef} className={`card-preview ${mobileSheet ? 'mobile-card-sheet' : ''}`} role="dialog" aria-modal="true" aria-label={`Imagem de ${card.name || 'Carta face para baixo'}`} onClick={event => event.stopPropagation()}>
      <div className={`card-preview-image ${card.tapped ? 'is-tapped' : ''}`}>
        <div className="card-preview-art">
        {!card.name ? <p>Face para baixo · identidade oculta.</p> : failed
          ? <p role="status">A imagem não está disponível agora.</p>
          : <img src={image} alt={`Imagem ampliada de ${card.name}`} onError={() => setFailed(true)} />}
        </div>
        {step === 'view' && (card.tapped || card.faceDown || card.revealed || card.power || card.toughness || markerCount) ? <div className="card-status-chips">
          {card.tapped && <span>Virada</span>}{card.faceDown && card.name && <span>Face para baixo</span>}
          {(card.power || card.toughness) ? <span>P/R {(card.power ?? 0) > 0 ? '+' : ''}{card.power ?? 0}/{(card.toughness ?? 0) > 0 ? '+' : ''}{card.toughness ?? 0}</span> : null}
          {markerCount !== 0 && <span>{markerCount} {markerCount === 1 ? 'marcador' : 'marcadores'} de cor</span>}{card.revealed && <span className="is-public">Revelada para todos</span>}
        </div> : null}
      </div>
      <div className="card-preview-actions">
      <PanelHeader title={title} subtitle={step === 'view' ? zone : card.name || 'Carta face para baixo'} onClose={() => onCloseRef.current()} closeLabel="Fechar" onBack={step !== 'view' ? () => setStep('view') : undefined} />
      <PanelFeedback error={error} busy={busy} unconfirmed={Boolean(unconfirmed && onRetry)} onRetry={onRetry ?? (async () => false)} />
      {step === 'view' && <>
        {card.text && <p className="instance-text">{card.text}</p>}
        {mobileSheet && players && <div className="card-reading-owner"><span>Dono: {players.find(player => player.userId === card.ownerId)?.name ?? 'desconhecido'}</span><button className="secondary" onClick={() => onFocusOwner?.(card.ownerId)}>Ver campo</button></div>}
        {controlled && <div className="card-quick-actions">
          {viewerId && onStateChange && card.zone === 'battlefield' && <CardStateControls mode="quick" card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} />}
        </div>}
        <section className="card-inspection-section" aria-label="Estado da carta">
          <h3 className="card-section-heading">Estado</h3>
          <div className="card-inspection-row"><span>Poder / Resistência</span>{editable && onCounter
            ? <PowerToughnessAdjust key={card.id} power={card.power ?? 0} toughness={card.toughness ?? 0} disabled={disabled} owed={owedPair} onApply={(subject, operation, value) => onCounter(subject, operation, value)} />
            : <span className="card-pt-readout" aria-label="Modificador de poder e resistência">{card.power ?? 0} / {card.toughness ?? 0}</span>}</div>
          <div className="card-inspection-row"><span>Marcadores de cor</span><div className="card-marker-summary">
            {activeMarkers.length ? <span className="card-marker-values">{activeMarkers.map(item => <span key={item.color} aria-label={`marcador ${item.name}: ${markerValue(card.markers, item.color)}`}><i className={`card-marker-diamond marker-${item.color}`} />{markerValue(card.markers, item.color)}</span>)}</span> : <span className="card-marker-empty">Nenhum</span>}
            {editable && onCounter && <button className="secondary" disabled={disabled} onClick={() => setStep('markers')}>{activeMarkers.length ? 'Editar' : 'Adicionar'} <TableIcon name="chevron" /></button>}
          </div></div>
          {viewerId && onStateChange && controlled && <div className="card-inspection-row card-visibility-row"><span>Visibilidade</span><CardStateControls mode="other" card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} /></div>}
          {card.revealed && controlled && onHide && <label className="keep-revealed"><input type="checkbox" checked={keepRevealed} onChange={event => setKeepRevealed(event.target.checked)} />Manter revelada ao fechar (até passar o turno)</label>}
        </section>
        {controlled && card.ownerId === viewerId && onMove && <section className="card-inspection-section"><h3 className="card-section-heading">Mover para</h3><div className="card-move-grid">
          {destinations.filter(destination => destination.value !== card.zone).map(destination => <button className="secondary" key={destination.value} disabled={disabled} onClick={() => void onMove(card.id, destination.value)}><TableIcon name={destination.icon} />{destination.value === 'library-top' ? 'Topo' : destination.value === 'library-bottom' ? 'Fundo' : destination.title}</button>)}
        </div></section>}
        {viewerId && players && onTransfer && onMoveToOwner && <CardControlTransfer key={card.id} card={card} players={players} viewerId={viewerId} disabled={disabled} onTransfer={onTransfer} onMoveToOwner={onMoveToOwner} />}
        {onCopy && card.id && card.name && <button className="secondary card-copy-action" aria-label="Criar cópia independente" disabled={busy || disabled} onClick={() => onCopy(card.id)}><TableIcon name="copy" /><strong>Criar cópia independente</strong><span>· nova instância no seu campo</span></button>}
        {onCreateToken && card.createdTokens?.map(token => <button key={token} className="secondary card-copy-action" aria-label={`Criar ficha feita pela carta: ${token}`} disabled={busy || disabled} onClick={() => onCreateToken(token)}><TableIcon name="copy" /><strong>Criar ficha feita pela carta</strong><span>· {token}</span></button>)}
      </>}
      {step === 'markers' && editable && onCounter && <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter('marker', operation, value, color)} />}
      </div>
    </div>
  </div>;
}
