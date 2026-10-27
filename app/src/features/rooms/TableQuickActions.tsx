import { TableIcon } from './TableIcon';

export function TableQuickActions({ disabled, canDraw, actionsOpen, onTurn, onDraw, onUntap, onActions }: {
  disabled: boolean; canDraw: boolean; actionsOpen: boolean;
  onTurn: () => void; onDraw: () => void; onUntap: () => void; onActions: (anchor: HTMLButtonElement) => void;
}) {
  return <nav className="quick-actions" aria-label="Ações rápidas">
    <button className="secondary" disabled={disabled} aria-label="Passar turno" title="Passar turno (N)" aria-keyshortcuts="N" onClick={onTurn}><TableIcon name="next" /><span>Passar turno</span><kbd aria-hidden="true">N</kbd></button>
    <button disabled={disabled || !canDraw} aria-label="Comprar" title="Comprar uma carta (D)" aria-keyshortcuts="D" onClick={onDraw}><TableIcon name="draw" /><span>Comprar</span><kbd aria-hidden="true">D</kbd></button>
    <button className="secondary" disabled={disabled} aria-label="Desvirar todas" title="Desvirar todas as permanentes (U)" aria-keyshortcuts="U" onClick={onUntap}><TableIcon name="untap" /><span>Desvirar todas</span><kbd aria-hidden="true">U</kbd></button>
    <button type="button" className="actions-toggle secondary" aria-label="Ações" aria-expanded={actionsOpen} onClick={event => onActions(event.currentTarget)}><TableIcon name="actions" /><span>Mais</span></button>
  </nav>;
}
