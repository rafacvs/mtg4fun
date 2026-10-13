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
      <label>Quantidade<input aria-label={`Quantidade de ${label}`} type="number" step="1" value={amount} aria-invalid={!integer} onChange={event => setAmount(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && integer && !disabled) { event.preventDefault(); apply('set', numeric); } }} /></label>
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

function NumericCounter({ label, value, disabled, onApply }: { label: string; value: number; disabled: boolean; onApply: Apply }) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<number | null>(null);
  const numeric = integerText(draft);
  useEffect(() => { if (document.activeElement !== inputRef.current) setDraft(String(value)); }, [value]);
  useEffect(() => {
    if (disabled || pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    if (next !== value) void onApply('set', next);
  }, [disabled, value, onApply]);
  const confirm = () => {
    if (numeric === null || numeric === value) return;
    if (disabled) pending.current = numeric;
    else void onApply('set', numeric);
  };
  return <div className="numeric-counter">
    <button type="button" className="secondary" aria-label={`Diminuir ${label}`} disabled={disabled} onClick={() => void onApply('increment', -1)}>−</button>
    <input ref={inputRef} aria-label={label} title="Digite um inteiro e pressione Enter" type="number" step="1" value={draft} aria-invalid={numeric === null} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirm(); } }} onBlur={() => { if (numeric === null) setDraft(String(value)); else confirm(); }} />
    <button type="button" className="secondary" aria-label={`Aumentar ${label}`} disabled={disabled} onClick={() => void onApply('increment', 1)}>+</button>
  </div>;
}

export function PowerToughnessAdjust({ power, toughness, disabled, onApply }: { power: number; toughness: number; disabled: boolean; onApply: (subject: 'power' | 'toughness', operation: CounterOperation, value: number) => Promise<boolean> }) {
  return <div className="pt-line">
    <div className="pt-control"><span>Poder</span><NumericCounter label="Poder" value={power} disabled={disabled} onApply={(operation, value) => onApply('power', operation, value)} /></div>
    <div className="pt-control"><span>Resistência</span><NumericCounter label="Resistência" value={toughness} disabled={disabled} onApply={(operation, value) => onApply('toughness', operation, value)} /></div>
  </div>;
}

function MarkerRow({ name, color, value, disabled, onApply }: { name: string; color: MarkerColor; value: number; disabled: boolean; onApply: (color: MarkerColor, operation: CounterOperation, value: number) => Promise<boolean> }) {
  return <div className="marker-row">
    <span className={`marker-dot marker-${color}`} aria-hidden="true" />
    <NumericCounter label={`marcador ${name}`} value={value} disabled={disabled} onApply={(operation, value) => onApply(color, operation, value)} />
  </div>;
}

export function MarkerRows({ markers, disabled, onApply }: { markers?: Markers; disabled: boolean; onApply: (color: MarkerColor, operation: CounterOperation, value: number) => Promise<boolean> }) {
  return <div className="marker-rows">
    {markerColors.map(item => <MarkerRow key={item.color} name={item.name} color={item.color} value={markerValue(markers, item.color)} disabled={disabled} onApply={onApply} />)}
  </div>;
}
