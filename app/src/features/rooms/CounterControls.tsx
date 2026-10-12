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

export function PowerToughnessAdjust({ disabled, onApply }: { disabled: boolean; onApply: (subject: 'power' | 'toughness', operation: CounterOperation, value: number) => Promise<boolean> }) {
  const [power, setPower] = useState('1');
  const [toughness, setToughness] = useState('1');
  const read = (raw: string) => {
    const numeric = Number(raw);
    return { numeric, integer: raw.trim() !== '' && Number.isSafeInteger(numeric) };
  };
  const left = read(power);
  const right = read(toughness);
  const ready = left.integer && right.integer;
  const canShift = ready && left.numeric >= 0 && right.numeric >= 0 && (left.numeric > 0 || right.numeric > 0);
  const apply = async (operation: CounterOperation, powerValue: number, toughnessValue: number) => {
    if (!await onApply('power', operation, powerValue)) return;
    await onApply('toughness', operation, toughnessValue);
  };
  return <div className="adjust-block">
    <div className="pt-line">
      <input aria-label="Quantidade de poder" type="number" step="1" value={power} onChange={event => setPower(event.target.value)} />
      <span className="pt-slash" aria-hidden="true">/</span>
      <input aria-label="Quantidade de resistência" type="number" step="1" value={toughness} onChange={event => setToughness(event.target.value)} />
    </div>
    <div className="pt-actions">
      <button type="button" disabled={disabled || !ready} onClick={() => void apply('set', left.numeric, right.numeric)}>Definir</button>
      <button type="button" disabled={disabled || !canShift} onClick={() => void apply('increment', left.numeric, right.numeric)}>Adicionar</button>
      <button type="button" disabled={disabled || !canShift} onClick={() => void apply('increment', -left.numeric, -right.numeric)}>Subtrair</button>
    </div>
  </div>;
}

function MarkerRow({ name, color, value, disabled, onApply }: { name: string; color: MarkerColor; value: number; disabled: boolean; onApply: (color: MarkerColor, operation: CounterOperation, value: number) => Promise<boolean> }) {
  const [amount, setAmount] = useState('1');
  const numeric = Number(amount);
  const integer = amount.trim() !== '' && Number.isSafeInteger(numeric);
  const positive = integer && numeric > 0;
  return <div className="marker-row">
    <button type="button" className="secondary" aria-label={`Diminuir marcador ${name}`} disabled={disabled || !positive} onClick={() => void onApply(color, 'increment', -numeric)}>−</button>
    <input aria-label={`Quantidade de marcador ${name}`} type="number" step="1" min="1" value={amount} onChange={event => setAmount(event.target.value)} />
    <button type="button" className="secondary" aria-label={`Aumentar marcador ${name}`} disabled={disabled || !positive} onClick={() => void onApply(color, 'increment', numeric)}>+</button>
    <button type="button" aria-label={`Definir marcador ${name}`} disabled={disabled || !integer} onClick={() => void onApply(color, 'set', numeric)}>Definir</button>
    <span className={`marker-dot marker-${color}`} aria-hidden="true">{value}</span>
  </div>;
}

export function MarkerRows({ markers, disabled, onApply }: { markers?: Markers; disabled: boolean; onApply: (color: MarkerColor, operation: CounterOperation, value: number) => Promise<boolean> }) {
  return <div className="marker-rows">
    {markerColors.map(item => <MarkerRow key={item.color} name={item.name} color={item.color} value={markerValue(markers, item.color)} disabled={disabled} onApply={onApply} />)}
  </div>;
}
