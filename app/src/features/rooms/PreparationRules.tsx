import { useEffect, useState } from 'react';
import { TableIcon } from './TableIcon';
import type { Room } from './roomsApi';

type Settings = Partial<Pick<Room, 'life' | 'commanderToCommand' | 'drawOpeningHand'>>;
type MulliganMode = Room['mulliganMode'];

const mulliganModes: Record<MulliganMode, { label: string; detail: string }> = {
  standard: { label: 'Padrão', detail: 'Primeiro grátis; depois, uma carta ao fundo por mulligan' },
  aconchegaz: { label: 'Aconchegaz', detail: 'Sempre sete cartas novas, sem redução' },
};

export function PreparationRules({ room, editable, busy, onPendingChange, onChange, onMulliganMode }: { room: Room; editable: boolean; busy: boolean; onPendingChange: (pending: boolean) => void; onChange: (settings: Settings) => Promise<boolean>; onMulliganMode: (mode: MulliganMode) => Promise<boolean> }) {
  const [life, setLife] = useState(String(room.life));
  const [invalid, setInvalid] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setLife(String(room.life)); setInvalid(false); }, [room.life]);
  async function saveLife(next = life) {
    const value = Number(next);
    if (!/^\d+$/.test(next) || !Number.isInteger(value) || value < 1 || value > 999) { setInvalid(true); onPendingChange(true); return; }
    setInvalid(false);
    setEditing(false);
    if (value !== room.life && !await onChange({ life: value })) setLife(String(room.life));
    onPendingChange(false);
  }
  function adjustLife(delta: number) {
    const value = Number(editing ? life : room.life);
    if (!Number.isInteger(value) || value < 1 || value > 999 || (editing && !/^\d+$/.test(life))) { setInvalid(true); onPendingChange(true); return; }
    const next = Math.max(1, Math.min(999, value + delta));
    setLife(String(next));
    void saveLife(String(next));
  }
  const disabled = !editable || busy;
  return <section className="preparation-rules" aria-label="Regras da mesa">
    <div className="preparation-rules-heading"><span>REGRAS DA MESA</span><small><TableIcon name="lock" />{editable ? 'Você criou a sala: só você edita. Todos veem.' : 'Somente o criador pode editar.'}</small></div>
    <div className="preparation-rule-grid">
      <div className="preparation-rule"><strong><span aria-hidden="true"><TableIcon name="heart" /></span> Vida inicial</strong><div className="preparation-life">
        <button type="button" className="preparation-life-step" aria-label="Diminuir vida inicial" disabled={disabled || (!editing && room.life <= 1)} onPointerDown={event => { if (editing) event.preventDefault(); }} onClick={() => adjustLife(-1)}>−</button>
        {editing ? <input autoFocus type="number" inputMode="numeric" min="1" max="999" step="1" aria-label="Vida inicial" aria-invalid={invalid} value={life} disabled={busy} onChange={event => { setLife(event.target.value); setInvalid(false); onPendingChange(event.target.value !== String(room.life)); }} onBlur={() => void saveLife()} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setLife(String(room.life)); setInvalid(false); onPendingChange(false); setEditing(false); } }} /> : <button type="button" className="preparation-life-value" aria-label={`Vida inicial: ${room.life}${editable ? '. Clique para editar' : ''}`} disabled={disabled} onClick={() => { setLife(String(room.life)); setEditing(true); }}>{room.life}</button>}
        <button type="button" className="preparation-life-step" aria-label="Aumentar vida inicial" disabled={disabled || (!editing && room.life >= 999)} onPointerDown={event => { if (editing) event.preventDefault(); }} onClick={() => adjustLife(1)}>+</button>
      </div>{invalid && <small role="alert">Use um inteiro de 1 a 999.</small>}</div>
      <div className="preparation-rule"><strong><span aria-hidden="true"><TableIcon name="crown" /></span> Comandante na zona de comando</strong><div className="preparation-rule-detail"><small>{room.commanderToCommand ? 'Começa na zona de comando' : 'Embaralhado no grimório'}</small><button type="button" role="switch" aria-checked={room.commanderToCommand} disabled={disabled} aria-label="Comandante na zona de comando" onClick={() => void onChange({ commanderToCommand: !room.commanderToCommand })}><span /></button></div></div>
      <div className="preparation-rule"><strong><span aria-hidden="true"><TableIcon name="cards" /></span> Comprar até 7 cartas</strong><div className="preparation-rule-detail"><small>{room.drawOpeningHand ? 'Compra ao começar' : 'Sem compra automática'}</small><button type="button" role="switch" aria-checked={room.drawOpeningHand} disabled={disabled} aria-label="Comprar até 7 cartas" onClick={() => void onChange({ drawOpeningHand: !room.drawOpeningHand })}><span /></button></div></div>
      <div className="preparation-rule"><strong title={mulliganModes[room.mulliganMode].detail}><span aria-hidden="true"><TableIcon name="untap" /></span> Mulligan</strong><div className="preparation-rule-detail"><div className="preparation-mulligan" role="radiogroup" aria-label="Tipo de mulligan">{(Object.keys(mulliganModes) as MulliganMode[]).map(mode => <button key={mode} type="button" role="radio" aria-checked={room.mulliganMode === mode} disabled={disabled} onClick={() => { if (room.mulliganMode !== mode) void onMulliganMode(mode); }}>{mulliganModes[mode].label}</button>)}</div></div></div>
    </div>
  </section>;
}
