import { useEffect, useRef, useState } from 'react';
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

function integerText(raw: string) {
  if (raw.trim() === '' || raw === '-' || raw === '+') return null;
  const numeric = Number(raw);
  return Number.isSafeInteger(numeric) ? numeric : null;
}

export function PowerToughnessAdjust({ power, toughness, disabled, onApply }: { power: number; toughness: number; disabled: boolean; onApply: (subject: 'power' | 'toughness', operation: CounterOperation, value: number) => Promise<boolean> }) {
  const [left, setLeft] = useState(String(power));
  const [right, setRight] = useState(String(toughness));
  const powerRef = useRef<HTMLInputElement>(null);
  const toughnessRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== powerRef.current) setLeft(String(power)); }, [power]);
  useEffect(() => { if (document.activeElement !== toughnessRef.current) setRight(String(toughness)); }, [toughness]);
  const commit = (subject: 'power' | 'toughness', raw: string, current: number) => {
    const numeric = integerText(raw);
    if (numeric === null || numeric === current || disabled) return;
    void onApply(subject, 'set', numeric);
  };
  return <div className="pt-line">
    <input ref={powerRef} aria-label="Poder" type="number" step="1" value={left} onChange={event => { setLeft(event.target.value); commit('power', event.target.value, power); }} onBlur={() => { if (integerText(left) === null) setLeft(String(power)); }} />
    <span className="pt-slash" aria-hidden="true">/</span>
    <input ref={toughnessRef} aria-label="Resistência" type="number" step="1" value={right} onChange={event => { setRight(event.target.value); commit('toughness', event.target.value, toughness); }} onBlur={() => { if (integerText(right) === null) setRight(String(toughness)); }} />
  </div>;
}

function MarkerRow({ name, color, value, disabled, onApply }: { name: string; color: MarkerColor; value: number; disabled: boolean; onApply: (color: MarkerColor, operation: CounterOperation, value: number) => Promise<boolean> }) {
  return <div className="marker-row">
    <span className={`marker-dot marker-${color}`} aria-hidden="true" />
    <button type="button" className="secondary" aria-label={`Diminuir marcador ${name}`} disabled={disabled} onClick={() => void onApply(color, 'increment', -1)}>−</button>
    <strong className="marker-count">{value}</strong>
    <button type="button" className="secondary" aria-label={`Aumentar marcador ${name}`} disabled={disabled} onClick={() => void onApply(color, 'increment', 1)}>+</button>
  </div>;
}

export function MarkerRows({ markers, disabled, onApply }: { markers?: Markers; disabled: boolean; onApply: (color: MarkerColor, operation: CounterOperation, value: number) => Promise<boolean> }) {
  return <div className="marker-rows">
    {markerColors.map(item => <MarkerRow key={item.color} name={item.name} color={item.color} value={markerValue(markers, item.color)} disabled={disabled} onApply={onApply} />)}
  </div>;
}
