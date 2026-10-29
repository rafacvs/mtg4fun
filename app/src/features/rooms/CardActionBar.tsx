import { useRef, useState } from 'react';
import { markerColors } from './CounterControls';
import type { BatchCounterAction, Card } from './roomsApi';
import './card-actions.css';

export function CardActionBar({ cards, viewerId, disabled, onApply }: {
  cards: Card[]; viewerId: number; disabled: boolean;
  onApply: (action: BatchCounterAction) => Promise<boolean>;
}) {
  const [markersOpen, setMarkersOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const submitted = useRef('');
  if (!cards.length) return null;
  const ids = cards.map(card => card.id);
  const editable = cards.every(card => card.zone === 'battlefield' ? card.controllerId === viewerId : card.ownerId === viewerId);
  const pair = (delta: number) => { submitted.current = ''; return onApply({ cardIds: ids, subject: 'pair', operation: 'increment', value: delta, secondValue: delta }); };
  const applyPair = () => {
    const values = /^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/.exec(draft);
    if (!values || disabled) return;
    const power = Number(values[1]); const toughness = Number(values[2]);
    const signature = JSON.stringify([ids, power, toughness]);
    if (Number.isSafeInteger(power) && Number.isSafeInteger(toughness) && submitted.current !== signature) {
      submitted.current = signature;
      void onApply({ cardIds: ids, subject: 'pair', operation: 'set', value: power, secondValue: toughness }).then(ok => { if (!ok) submitted.current = ''; });
    }
  };
  return <div className="card-action-bar" role="toolbar" aria-label="Ações da seleção">
    <span>{cards.length} selecionada{cards.length > 1 ? 's' : ''}</span>
    {editable && <>
      <button disabled={disabled} onClick={() => void pair(1)}>+1/+1</button>
      <button disabled={disabled} onClick={() => void pair(-1)}>-1/-1</button>
      <label>Poder/resistência <input aria-label="Poder/resistência" placeholder="X/Y" value={draft} disabled={disabled} onChange={event => { submitted.current = ''; setDraft(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyPair(); } }} onBlur={applyPair} /></label>
      <button disabled={disabled} aria-expanded={markersOpen} onClick={() => setMarkersOpen(open => !open)}>Marcadores</button>
      {markersOpen && <div className="selection-markers" role="group" aria-label="Marcadores da seleção">{markerColors.map(({ color, name }) => <div key={color}><span className={`marker-dot marker-${color}`} aria-hidden="true" /><span>{name}</span>{([-1, 1] as const).map(value => <button key={value} disabled={disabled} aria-label={`${value === 1 ? 'Adicionar' : 'Remover'} marcador ${name}`} onClick={() => void onApply({ cardIds: ids, subject: 'marker', color, operation: 'increment', value })}>{value === 1 ? '+' : '−'}</button>)}</div>)}</div>}
    </>}
  </div>;
}
