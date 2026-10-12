import { useEffect, useRef, useState } from 'react';
import type { Card, CounterAction, Match } from './roomsApi';
import { CounterValues } from './CounterValues';
import { zoneNames } from './PlayerTable';
import './counters.css';

type Props = { open: boolean; match: Match; busy: boolean; error: string; unconfirmed: boolean; onRetry: () => Promise<boolean>; onChange: (input: CounterAction) => Promise<boolean>; onClose: () => void };

export function CounterControls({ open, match, busy, error, unconfirmed, onRetry, onChange, onClose }: Props) {
  const [target, setTarget] = useState('player');
  const [name, setName] = useState('Vida');
  const [value, setValue] = useState('1');
  const closeRef = useRef<HTMLButtonElement>(null);
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const cards = new Map<string, Card>();
  for (const player of match.players) {
    for (const card of [...player.hand ?? [], ...player.battlefield ?? [], ...player.graveyard ?? [], ...player.exile ?? [], ...player.command ?? [], ...player.consulted ?? [], ...player.revealed ?? []]) {
      if ((card.zone === 'battlefield' ? card.controllerId : card.ownerId) === match.viewerId) cards.set(card.id, card);
    }
  }
  const selected = cards.get(target);
  const numericValue = Number(value);
  const canChange = !busy && !unconfirmed && (target === 'player' || Boolean(selected)) && Boolean(name.trim()) && [...name.trim()].length <= 80 && value.trim() !== '' && Number.isSafeInteger(numericValue);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);

  if (!open) return null;
  const change = (operation: 'set' | 'increment') => {
    if (!canChange) return;
    const input: CounterAction = target === 'player'
      ? { target: 'player', playerId: match.viewerId, name: name.trim(), operation, value: numericValue }
      : { target: 'card', cardId: target, name: name.trim(), operation, value: numericValue };
    void onChange(input);
  };
  return <div className="actions-panel counter-panel" role="dialog" aria-label="Vida e contadores">
    <header><h2>Vida e contadores</h2><button ref={closeRef} className="secondary" aria-label="Fechar contadores" onClick={onClose}>×</button></header>
    {error && <p role="alert">{error}{unconfirmed && <button disabled={busy} onClick={() => void onRetry()}>Tentar novamente</button>}</p>}
    <label>Alvo do contador<select value={target} onChange={event => setTarget(event.target.value)}>
      <option value="player">Você · {own.name}</option>
      {[...cards.values()].map((card, index) => <option key={card.id} value={card.id}>{card.name} · {zoneNames[card.zone]} · {index + 1}</option>)}
    </select></label>
    <div className="counter-current" aria-live="polite">
      {target === 'player' && <span>Vida: {own.life}</span>}
      <CounterValues counters={target === 'player' ? own.counters : selected?.counters} />
    </div>
    <label>Nome do contador<input value={name} onChange={event => setName(event.target.value)} list="counter-names" /></label>
    <datalist id="counter-names">{(target === 'player' ? ['Vida', ...Object.keys(own.counters ?? {})] : Object.keys(selected?.counters ?? {})).map(counter => <option key={counter} value={counter} />)}</datalist>
    <label>Valor do contador<input type="number" step="1" value={value} onChange={event => setValue(event.target.value)} /></label>
    <p>Definir substitui o valor. Incrementar soma ou subtrai; use um número negativo para diminuir.</p>
    <div className="actions-grid"><button disabled={!canChange} onClick={() => change('set')}>Definir</button><button disabled={!canChange} onClick={() => change('increment')}>Incrementar</button></div>
  </div>;
}
