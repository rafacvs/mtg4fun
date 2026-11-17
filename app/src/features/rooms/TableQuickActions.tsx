import drawIcon from '../../assets/theme/comprar-carta.png';
import { TableIcon } from './TableIcon';
import type { ShortcutBindings } from './libraryGesture';

export function TableQuickActions({ disabled, canDraw, bindings, actionsOpen, logOpen, onChronicle, onTurn, onPreviousTurn, onDraw, onUntap, onFitAll, onActions, deadCount, hideDead, onToggleDead }: {
  bindings: ShortcutBindings;
  disabled: boolean; canDraw: boolean; actionsOpen: boolean; deadCount: number; hideDead: boolean; onToggleDead: () => void;
  logOpen: boolean; onChronicle: () => void; onTurn: () => void; onPreviousTurn: () => void; onDraw: () => void; onUntap: () => void; onFitAll: () => void; onActions: (anchor: HTMLButtonElement) => void;
}) {
  return <nav className="quick-actions" aria-label="Ações rápidas">
    <button className="secondary bar-action draw-action" disabled={disabled || !canDraw} aria-label="Comprar" title={`Comprar uma carta (${bindings.draw})`} aria-keyshortcuts={bindings.draw} onClick={onDraw}><span className="draw-icon" aria-hidden="true"><span style={{ maskImage: `url(${drawIcon})` }} /></span><kbd aria-hidden="true">{bindings.draw}</kbd></button>
    <button className="secondary bar-action untap-action" disabled={disabled} aria-label="Desvirar" title={`Desvirar todas as permanentes (${bindings.untap})`} aria-keyshortcuts={bindings.untap} onClick={onUntap}><TableIcon name="untap" /><kbd aria-hidden="true">{bindings.untap}</kbd></button>
    <button type="button" className="secondary bar-action fit-all-action" aria-label="Ajustar todos os campos" title="Mostrar todas as cartas em todos os campos" onClick={onFitAll}><TableIcon name="focus" /></button>
    {deadCount > 0 && <DeadFieldsToggle count={deadCount} hidden={hideDead} onToggle={onToggleDead} />}
    <button type="button" className="actions-toggle secondary bar-action" aria-label="Ações" aria-expanded={actionsOpen} onClick={event => onActions(event.currentTarget)}><TableIcon name="more" /></button>
    <div className="turn-control" role="group" aria-label="Turno"><button className="turn-previous" disabled={disabled} aria-label="Corrigir turno" title={`Voltar ao jogador anterior (${bindings.previousTurn})`} aria-keyshortcuts={bindings.previousTurn} onClick={onPreviousTurn}><TableIcon name="turn-previous" /></button><button className="turn-action" disabled={disabled} aria-label="Passar turno" title={`Passar turno (${bindings.turn})`} aria-keyshortcuts={bindings.turn} onClick={onTurn}><span>Turno</span><TableIcon name="turn-next" /></button></div>
    <button type="button" className="secondary bar-action chronicle-toggle" aria-expanded={logOpen} aria-controls="log-panel-content" aria-label={logOpen ? 'Fechar crônica' : 'Abrir crônica'} title={logOpen ? 'Fechar crônica' : 'Abrir crônica'} onClick={onChronicle}><TableIcon name="log" /></button>
  </nav>;
}

export function DeadFieldsToggle({ count, hidden, onToggle, className = 'bar-action' }: { count: number; hidden: boolean; onToggle: () => void; className?: string }) {
  const label = hidden ? `Mostrar campos de quem morreu (${count})` : `Ocultar campos de quem morreu (${count})`;
  return <button type="button" className={`secondary ${className} dead-fields-toggle`} aria-pressed={hidden} aria-label={label} title={label} onClick={onToggle}><TableIcon name="skull" />{hidden && <small aria-hidden="true">{count}</small>}</button>;
}
