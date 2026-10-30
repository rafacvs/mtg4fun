import { TableIcon } from './TableIcon';

export function TableQuickActions({ disabled, canDraw, canMulligan, canKeep, keepLabel, actionsOpen, onTurn, onDraw, onMulligan, onKeep, onUntap, onActions }: {
  disabled: boolean; canDraw: boolean; actionsOpen: boolean;
  canMulligan: boolean; canKeep: boolean; keepLabel: string; onTurn: () => void; onDraw: () => void; onMulligan: () => void; onKeep: () => void; onUntap: () => void; onActions: (anchor: HTMLButtonElement) => void;
}) {
  return <nav className="quick-actions" aria-label="Ações rápidas">
    {canMulligan && <button className="secondary bar-action mulligan-action" disabled={disabled} onClick={onMulligan}><TableIcon name="shuffle" /><span>Mulligan</span></button>}
    {canKeep && <button className="secondary bar-action keep-hand-action" disabled={disabled} title={keepLabel} onClick={onKeep}><TableIcon name="hand" /><span>Manter mão</span></button>}
    <button className="secondary bar-action draw-action" disabled={disabled || !canDraw} aria-label="Comprar" title="Comprar uma carta (D)" aria-keyshortcuts="D" onClick={onDraw}><TableIcon name="cards" /><span>Comprar</span><kbd aria-hidden="true">D</kbd></button>
    <button className="secondary bar-action" disabled={disabled} aria-label="Desvirar todas" title="Desvirar todas as permanentes (U)" aria-keyshortcuts="U" onClick={onUntap}><TableIcon name="untap" /><span>Desvirar todas</span><kbd aria-hidden="true">U</kbd></button>
    <button type="button" className="actions-toggle secondary bar-action" aria-label="Ações" aria-expanded={actionsOpen} onClick={event => onActions(event.currentTarget)}><TableIcon name="more" /><span>Mais</span></button>
    <button className="turn-action" disabled={disabled} aria-label="Passar turno" title="Passar turno (N)" aria-keyshortcuts="N" onClick={onTurn}><span>Passar turno</span><TableIcon name="next" /><kbd aria-hidden="true">N</kbd></button>
  </nav>;
}
