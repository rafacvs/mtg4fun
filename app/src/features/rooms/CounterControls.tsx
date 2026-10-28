import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
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

function integerText(raw: string) {
  if (raw.trim() === '' || raw === '-' || raw === '+') return null;
  const numeric = Number(raw);
  return Number.isSafeInteger(numeric) ? numeric : null;
}

function NumericField({ inputLabel, value, disabled, onApply, textual = false }: {
  inputLabel: string; value: number; disabled: boolean; onApply: Apply; textual?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<number | null>(null);
  const submitted = useRef<number | null>(null);
  const restoreFocus = useRef(false);
  const numeric = integerText(draft);
  useEffect(() => { if (document.activeElement !== inputRef.current) setDraft(String(value)); }, [value]);
  useEffect(() => { if (submitted.current === value) submitted.current = null; }, [value]);
  useEffect(() => {
    if (disabled || pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    if (next === value || submitted.current === next) return;
    submitted.current = next;
    void onApply('set', next);
  }, [disabled, value, onApply]);
  useLayoutEffect(() => {
    if (disabled || !restoreFocus.current) return;
    restoreFocus.current = false;
    const active = document.activeElement;
    if (active === document.body || active === document.documentElement) inputRef.current?.focus({ preventScroll: true });
  }, [disabled]);
  const confirm = () => {
    if (numeric === null || numeric === value || submitted.current === numeric || pending.current === numeric) return;
    if (disabled) { pending.current = numeric; return; }
    submitted.current = numeric;
    void onApply('set', numeric);
  };
  return <input ref={inputRef} aria-label={inputLabel} title="Digite um inteiro e pressione Enter" type={textual ? 'text' : 'number'} inputMode={textual ? 'decimal' : undefined} autoComplete="off" spellCheck={false} step={textual ? undefined : 1} value={draft} aria-invalid={numeric === null} disabled={disabled} onChange={event => {
    const next = event.target.value;
    setDraft(next);
    if (integerText(next) !== submitted.current) submitted.current = null;
  }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirm(); } }} onBlur={event => {
    if (disabled || event.currentTarget.disabled) restoreFocus.current = true;
    if (numeric === null) setDraft(String(value));
    else confirm();
  }} />;
}

export function NumericCounter({ label, inputLabel = label, value, disabled, onApply, textual = false }: {
  label: string; inputLabel?: string; value: number; disabled: boolean; onApply: Apply; textual?: boolean;
}) {
  return <div className="numeric-counter">
    <button type="button" className="secondary" aria-label={`Diminuir ${label}`} disabled={disabled} onClick={() => void onApply('increment', -1)}>−</button>
    <NumericField inputLabel={inputLabel} value={value} disabled={disabled} onApply={onApply} textual={textual} />
    <button type="button" className="secondary" aria-label={`Aumentar ${label}`} disabled={disabled} onClick={() => void onApply('increment', 1)}>+</button>
  </div>;
}

export type OwedPair = { delta: number; expectedToughness: number };
const partialPairMessage = 'Poder confirmado. Resistência ficou pendente.';

export function PowerToughnessAdjust({ power, toughness, disabled, onApply, owed }: { power: number; toughness: number; disabled: boolean; onApply: (subject: 'power' | 'toughness', operation: CounterOperation, value: number) => Promise<boolean>; owed: MutableRefObject<OwedPair | null> }) {
  const pairing = useRef(false);
  const [locked, setLocked] = useState(false);
  const [partial, setPartial] = useState(() => owed.current && toughness !== owed.current.expectedToughness ? partialPairMessage : '');
  const controlsDisabled = disabled || locked;
  useEffect(() => {
    if (owed.current && toughness === owed.current.expectedToughness) {
      owed.current = null;
      setPartial('');
    }
  }, [toughness]);
  const shift = async (delta: -1 | 1) => {
    if (pairing.current || controlsDisabled) return;
    pairing.current = true;
    setLocked(true);
    const pendingPair = owed.current;
    try {
      if (pendingPair) {
        const recovered = await onApply('toughness', 'increment', pendingPair.delta);
        if (recovered) {
          owed.current = null;
          setPartial('');
        }
        return;
      }
      const baseline = toughness;
      const powerOk = await onApply('power', 'increment', delta);
      if (!powerOk) return;
      const toughnessOk = await onApply('toughness', 'increment', delta);
      if (!toughnessOk) {
        owed.current = { delta, expectedToughness: baseline + delta };
        setPartial(partialPairMessage);
      }
    } finally {
      pairing.current = false;
      setLocked(false);
    }
  };
  return <div className="pt-pair-block">
    <div className="pt-pair" role="group" aria-label="Poder e resistência">
      <button type="button" className="secondary" aria-label="Diminuir poder e resistência" disabled={controlsDisabled} onClick={() => void shift(-1)}>−</button>
      <span className="pt-value" data-positive={power > 0}><NumericField inputLabel="Poder" value={power} disabled={controlsDisabled} onApply={(operation, value) => onApply('power', operation, value)} textual /></span>
      <span className="pt-slash" aria-hidden="true">/</span>
      <span className="pt-value" data-positive={toughness > 0}><NumericField inputLabel="Resistência" value={toughness} disabled={controlsDisabled} onApply={(operation, value) => onApply('toughness', operation, value)} textual /></span>
      <button type="button" className="secondary" aria-label="Aumentar poder e resistência" disabled={controlsDisabled} onClick={() => void shift(1)}>+</button>
    </div>
    {partial && <p role="alert" className="error">{partial}</p>}
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
