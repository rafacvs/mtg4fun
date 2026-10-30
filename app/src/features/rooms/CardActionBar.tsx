import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { markerColors, markerValue, MarkerRows } from './CounterControls';
import { PanelHeader, TablePanel } from './TablePanel';
import { TableIcon } from './TableIcon';
import { cardImageURL } from './cardImage';
import type { BatchCounterAction, Card } from './roomsApi';
import './card-actions.css';

export function CardActionBar({ cards, viewerId, disabled, onApply, onClear }: {
  cards: Card[]; viewerId: number; disabled: boolean;
  onApply: (action: BatchCounterAction) => Promise<boolean>; onClear: () => void;
}) {
  const [markersOpen, setMarkersOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const submitted = useRef('');
  const first = cards[0];
  const common = first && cards.every(card => (card.power ?? 0) === (first.power ?? 0) && (card.toughness ?? 0) === (first.toughness ?? 0))
    ? `${first.power ?? 0}/${first.toughness ?? 0}` : '';
  const [draft, setDraft] = useState(common);
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(common);
  }, [common]);
  if (!first) return null;
  const ids = cards.map(card => card.id);
  const editable = cards.every(card => card.zone === 'battlefield' ? card.controllerId === viewerId : card.ownerId === viewerId);
  const mixedColors = markerColors.filter(({ color }) => cards.some(card => markerValue(card.markers, color) !== markerValue(first.markers, color))).map(item => item.color);
  const counts = Object.fromEntries(markerColors.map(({ color }) => [color, cards.filter(card => markerValue(card.markers, color) !== 0).length]));
  const activeColors = markerColors.filter(({ color }) => counts[color] > 0);
  const pair = (delta: number) => { submitted.current = ''; return onApply({ cardIds: ids, subject: 'pair', operation: 'increment', value: delta, secondValue: delta }); };
  const applyPair = () => {
    const values = /^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/.exec(draft);
    if (!values || disabled) return;
    const power = Number(values[1]); const toughness = Number(values[2]);
    const signature = JSON.stringify([ids, power, toughness]);
    if (Number.isSafeInteger(power) && Number.isSafeInteger(toughness) && draft !== common && submitted.current !== signature) {
      submitted.current = signature;
      void onApply({ cardIds: ids, subject: 'pair', operation: 'set', value: power, secondValue: toughness }).then(ok => { if (!ok) submitted.current = ''; });
    }
  };
  return <>
    <div className="card-action-bar" role="toolbar" aria-label="Ações da seleção">
      <div className="selection-heading"><span className="selection-fan" aria-hidden="true">{cards.slice(0, 4).map((card, index) => <img key={card.id} src={card.faceDown || !card.name ? '/library-back.png' : cardImageURL(card)} alt="" style={{ '--fan-index': index } as CSSProperties} />)}</span><div><strong>{cards.length} carta{cards.length > 1 ? 's' : ''}</strong><span>selecionada{cards.length > 1 ? 's' : ''}</span></div></div>
      {editable && <>
        <div className="selection-pair" role="group" aria-label="Poder e resistência da seleção">
          <div className="selection-pair-caption"><strong>Poder / resistência</strong><span>{common ? 'ajuste para todas' : 'ajustes diferentes · digite para igualar'}</span></div>
          <div className="selection-stepper"><button className="secondary" disabled={disabled} onClick={() => void pair(-1)}>-1/-1</button>
          <input ref={input} aria-label="Poder/resistência" placeholder="— / —" value={draft} disabled={disabled} onChange={event => { submitted.current = ''; setDraft(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyPair(); } }} onBlur={applyPair} />
          <button className="secondary" disabled={disabled} onClick={() => void pair(1)}>+1/+1</button></div>
        </div>
        <button ref={anchor} className="secondary selection-marker-button" disabled={disabled} aria-expanded={markersOpen} onClick={() => setMarkersOpen(open => !open)}><TableIcon name="markers" /><span>Marcadores</span>{activeColors.map(({color}) => <span key={color} className={`selection-marker-diamond marker-${color}`} aria-hidden="true" />)}<TableIcon name="chevron" /></button>
      </>}
      <button className="secondary selection-close" aria-label="Limpar seleção" onClick={onClear}><TableIcon name="close" /></button>
    </div>
    <TablePanel open={markersOpen} label="Marcadores da seleção" anchor={anchor.current} align="start" onClose={() => setMarkersOpen(false)} className="selection-marker-panel">
      <PanelHeader title="Marcadores de cor" subtitle={`nas ${cards.length} carta${cards.length > 1 ? 's' : ''}`} onClose={() => setMarkersOpen(false)} />
      <MarkerRows markers={first.markers} mixedColors={mixedColors} counts={counts} disabled={disabled} onApply={(color, operation, value) => onApply({ cardIds: ids, subject: 'marker', color, operation, value })} />
      <p className="selection-marker-hint">+ e − ajustam cada carta individualmente.</p>
    </TablePanel>
  </>;
}
