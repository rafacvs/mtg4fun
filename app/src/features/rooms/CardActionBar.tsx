import { useEffect, useRef, useState } from 'react';
import { markerColors, markerValue, MarkerRows } from './CounterControls';
import { PanelHeader, TablePanel } from './TablePanel';
import { TableIcon } from './TableIcon';
import type { BatchCounterAction, Card } from './roomsApi';
import './card-actions.css';

export function CardActionBar({ cards, viewerId, disabled, onApply }: {
  cards: Card[]; viewerId: number; disabled: boolean;
  onApply: (action: BatchCounterAction) => Promise<boolean>;
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
      <div className="selection-heading"><span className="selection-emblem"><TableIcon name="markers" /></span><div><span>Seleção</span><strong>{cards.length} carta{cards.length > 1 ? 's' : ''}</strong></div></div>
      {editable && <>
        <div className="selection-pair" role="group" aria-label="Poder e resistência da seleção">
          <button className="secondary" disabled={disabled} onClick={() => void pair(-1)}>-1/-1</button>
          <label><span>Poder / resistência</span><input ref={input} aria-label="Poder/resistência" placeholder="X / Y" value={draft} disabled={disabled} onChange={event => { submitted.current = ''; setDraft(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyPair(); } }} onBlur={applyPair} /></label>
          <button className="secondary" disabled={disabled} onClick={() => void pair(1)}>+1/+1</button>
        </div>
        <button ref={anchor} className="secondary selection-marker-button" disabled={disabled} aria-expanded={markersOpen} onClick={() => setMarkersOpen(true)}><TableIcon name="markers" /><span>Marcadores</span><TableIcon name="chevron" /></button>
      </>}
    </div>
    <TablePanel open={markersOpen} label="Marcadores da seleção" anchor={anchor.current} onClose={() => setMarkersOpen(false)} className="selection-marker-panel">
      <PanelHeader title="Marcadores" subtitle={`${cards.length} carta${cards.length > 1 ? 's' : ''} selecionada${cards.length > 1 ? 's' : ''}`} onClose={() => setMarkersOpen(false)} />
      <p className="selection-marker-hint">Ajuste os marcadores de todas as cartas selecionadas.</p>
      <MarkerRows markers={first.markers} mixedColors={mixedColors} disabled={disabled} onApply={(color, operation, value) => onApply({ cardIds: ids, subject: 'marker', color, operation, value })} />
    </TablePanel>
  </>;
}
