import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TablePanel } from './TablePanel';
import type { ManaColor, Match } from './roomsApi';
import './mana-pool.css';

export const ManaPoolActions = createContext<{ change: (color: ManaColor, amount: number) => Promise<boolean>; reset: () => Promise<boolean> } | null>(null);
const colors: { id: ManaColor; label: string }[] = [
  { id: 'white', label: 'Branca' }, { id: 'green', label: 'Verde' }, { id: 'blue', label: 'Azul' },
  { id: 'colorless', label: 'Incolor' }, { id: 'red', label: 'Vermelha' }, { id: 'black', label: 'Preta' },
];

export function ManaPool({ player, own, disabled }: { player: Match['players'][number]; own: boolean; disabled?: boolean }) {
  const actions = useContext(ManaPoolActions);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (!own || !actions) return;
    const show = () => { setChoosing(true); setOpen(true); };
    window.addEventListener('mana-pool-select', show);
    return () => window.removeEventListener('mana-pool-select', show);
  }, [own, actions]);
  return <>
    <button ref={anchor} type="button" className="mana-pool-slot" aria-label={`Reserva de mana de ${player.name}`} aria-expanded={open} onClick={() => { setChoosing(false); setOpen(true); }}>
      <span className="mana-pool-mini">{colors.map(color => <span key={color.id} className={`mana-orb mana-${color.id} ${(player.mana?.[color.id] ?? 0) > 0 ? 'is-lit' : ''}`}>{player.mana?.[color.id] ?? 0}</span>)}</span><span className="mana-pool-label">mana</span>
    </button>
    {createPortal(<TablePanel open={open} label={`Reserva de mana de ${player.name}`} anchor={anchor.current} aboveDock className="mana-pool-panel" onClose={() => setOpen(false)}>
      <div className="mana-pool-header"><strong>mana</strong>{own && actions && <button type="button" aria-label="Zerar e desvirar terrenos" disabled={disabled} onClick={() => void actions.reset()}>zerar</button>}</div>
      <div className="mana-pool-grid"><svg className="mana-pool-lines" viewBox="0 0 170 156" aria-hidden="true"><polygon points="85,34 132.55,68.55 114.39,124.45 55.61,124.45 37.45,68.55" fill="none" stroke="rgba(255,255,255,.07)" /><path d="M85,34 L114.39,124.45 L37.45,68.55 L132.55,68.55 L55.61,124.45 Z" fill="none" stroke="rgba(255,255,255,.05)" /></svg>{colors.map(color => <div key={color.id} className={`mana-pool-entry mana-position-${color.id}`}>
        <button type="button" className={`mana-orb mana-${color.id} ${(player.mana?.[color.id] ?? 0) > 0 ? 'is-lit' : ''}`} aria-label={`${own && actions ? 'Adicionar mana' : 'Mana'} ${color.label.toLowerCase()}: ${player.mana?.[color.id] ?? 0}`} disabled={!own || !actions || disabled} onClick={() => { void actions?.change(color.id, 1).then(ok => { if (ok && choosing) { setOpen(false); setChoosing(false); } }); }}>{player.mana?.[color.id] ?? 0}</button>
        {own && actions && <button type="button" className="mana-remove" aria-label={`Remover mana ${color.label.toLowerCase()}`} disabled={disabled || !(player.mana?.[color.id])} onClick={() => void actions.change(color.id, -1)}>−</button>}
      </div>)}</div>
      {own && actions && <p className="mana-pool-help">Toque na cor para adicionar; use − para gastar.</p>}
    </TablePanel>, document.querySelector('.match-board') ?? document.body)}
  </>;
}
