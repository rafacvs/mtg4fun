import { useState } from 'react';
import type { CounterAction } from './roomsApi';

type Operation = 'set' | 'increment';
type Apply = (operation: Operation, value: number) => Promise<boolean>;

function AmountFields({ label, disabled, onApply }: { label: string; disabled: boolean; onApply: Apply }) {
  const [value, setValue] = useState('1');
  const numeric = Number(value);
  const integer = value.trim() !== '' && Number.isSafeInteger(numeric);
  const positive = integer && numeric > 0;
  const apply = (operation: Operation, amount: number) => void onApply(operation, amount);
  return <div className="draw-row">
    <label>{label}<input aria-label={label} type="number" step="1" value={value} onChange={event => setValue(event.target.value)} /></label>
    <button type="button" disabled={disabled || !integer} onClick={() => apply('set', numeric)}>Definir</button>
    <button type="button" disabled={disabled || !positive} onClick={() => apply('increment', numeric)}>Adicionar</button>
    <button type="button" disabled={disabled || !positive} onClick={() => apply('increment', -numeric)}>Subtrair</button>
  </div>;
}

function Stepper({ label, value, disabled, onStep }: { label: string; value: number; disabled: boolean; onStep: (delta: number) => void }) {
  return <div className="draw-stepper">
    <button type="button" className="secondary" aria-label={`Diminuir ${label}`} disabled={disabled} onClick={() => onStep(-1)}>−</button>
    <strong className="life-value">{value}</strong>
    <button type="button" className="secondary" aria-label={`Aumentar ${label}`} disabled={disabled} onClick={() => onStep(1)}>+</button>
  </div>;
}

export function LifeControl({ life, playerId, disabled, onChange }: { life: number; playerId: number; disabled: boolean; onChange: (input: CounterAction) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const apply: Apply = async (operation, value) => {
    const ok = await onChange({ target: 'player', playerId, name: 'Vida', operation, value });
    if (ok) setOpen(false);
    return ok;
  };
  return <div className="counter-section">
    <div className="draw-row">
      <span>Vida</span>
      <Stepper label="vida" value={life} disabled={disabled} onStep={delta => void apply('increment', delta)} />
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>Outra quantidade</button>
    </div>
    {open && <AmountFields label="Quantidade de vida" disabled={disabled} onApply={apply} />}
  </div>;
}

function CounterRow({ name, value, disabled, onApply }: { name: string; value: number; disabled: boolean; onApply: Apply }) {
  const [open, setOpen] = useState(false);
  const apply: Apply = async (operation, amount) => {
    const ok = await onApply(operation, amount);
    if (ok) setOpen(false);
    return ok;
  };
  return <>
    <div className="draw-row">
      <span>{name}</span>
      <Stepper label={name} value={value} disabled={disabled} onStep={delta => void apply('increment', delta)} />
      <button type="button" aria-expanded={open} onClick={() => setOpen(current => !current)}>Outra quantidade</button>
    </div>
    {open && <AmountFields label="Valor do contador" disabled={disabled} onApply={apply} />}
  </>;
}

export function NamedCounters({ title, counters, names, disabled, onChange }: { title: string; counters?: Record<string, number>; names: string[]; disabled: boolean; onChange: (name: string, operation: Operation, value: number) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const [custom, setCustom] = useState('');
  const name = (picked || custom).trim();
  const valid = [...name].length > 0 && [...name].length <= 80;
  const create: Apply = async (operation, value) => {
    const ok = await onChange(name, operation, value);
    if (ok) { setOpen(false); setPicked(''); setCustom(''); }
    return ok;
  };
  return <section className="counter-section" aria-label={title}>
    <h3>{title}</h3>
    {Object.entries(counters ?? {}).map(([counter, value]) => <CounterRow key={counter} name={counter} value={value} disabled={disabled} onApply={(operation, amount) => onChange(counter, operation, amount)} />)}
    {!open && <button type="button" disabled={disabled} onClick={() => setOpen(true)}>Novo contador</button>}
    {open && <div className="counter-create">
      {names.length > 0 && <label>Nome já usado<select value={picked} onChange={event => setPicked(event.target.value)}>
        <option value="">Novo nome</option>
        {names.map(item => <option key={item} value={item}>{item}</option>)}
      </select></label>}
      {picked === '' && <label>Nome do contador<input value={custom} maxLength={80} onChange={event => setCustom(event.target.value)} /></label>}
      <AmountFields label="Valor do contador" disabled={disabled || !valid} onApply={create} />
    </div>}
  </section>;
}
