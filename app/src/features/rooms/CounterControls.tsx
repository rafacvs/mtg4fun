import { useState } from 'react';
import type { MarkerColor, Markers } from './roomsApi';

export type CounterOperation = 'set' | 'increment';
type Apply = (operation: CounterOperation, value: number) => Promise<boolean>;

export const markerColors: { color: MarkerColor; name: string }[] = [
  { color: 'red', name: 'vermelho' },
  { color: 'yellow', name: 'amarelo' },
  { color: 'green', name: 'verde' },
  { color: 'blue', name: 'azul' },
  { color: 'purple', name: 'roxo' },
];

export function markerValue(markers: Markers | undefined, color: MarkerColor) {
  return markers?.[color] ?? 0;
}

export function markerName(color: MarkerColor) {
  return markerColors.find(item => item.color === color)?.name ?? color;
}

export function QuantityAdjust({ label, value, disabled, onApply }: { label: string; value: number; disabled: boolean; onApply: Apply }) {
  const [amount, setAmount] = useState('1');
  const numeric = Number(amount);
  const integer = amount.trim() !== '' && Number.isSafeInteger(numeric);
  const positive = integer && numeric > 0;
  const apply = (operation: CounterOperation, next: number) => void onApply(operation, next);
  return <div className="adjust-block">
    <div className="draw-stepper">
      <button type="button" className="secondary" aria-label={`Diminuir ${label}`} disabled={disabled} onClick={() => apply('increment', -1)}>−</button>
      <strong className={label === 'vida' ? 'life-figure' : 'adjust-value'}>{value}</strong>
      <button type="button" className="secondary" aria-label={`Aumentar ${label}`} disabled={disabled} onClick={() => apply('increment', 1)}>+</button>
    </div>
    <div className="draw-row">
      <label>Quantidade<input aria-label={`Quantidade de ${label}`} type="number" step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <button type="button" disabled={disabled || !integer} onClick={() => apply('set', numeric)}>Definir</button>
      <button type="button" disabled={disabled || !positive} onClick={() => apply('increment', numeric)}>Adicionar</button>
      <button type="button" disabled={disabled || !positive} onClick={() => apply('increment', -numeric)}>Subtrair</button>
    </div>
  </div>;
}

export function MarkerPalette({ markers, disabled, onPick }: { markers?: Markers; disabled: boolean; onPick: (color: MarkerColor) => void }) {
  return <div className="marker-dots">
    {markerColors.map(item => <button key={item.color} type="button" className={`marker-dot marker-${item.color}`} aria-label={`marcador ${item.name}`} disabled={disabled} onClick={() => onPick(item.color)}>{markerValue(markers, item.color)}</button>)}
  </div>;
}
