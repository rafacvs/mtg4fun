import drawIcon from '../../assets/theme/comprar-carta.png';
import { TableIcon } from './TableIcon';

export function TableQuickActions({ disabled, canDraw, canMulligan, canKeep, keepLabel, actionsOpen, logOpen, onChronicle, onTurn, onPreviousTurn, onDraw, onMulligan, onKeep, onUntap, onFitAll, onActions }: {
  disabled: boolean; canDraw: boolean; actionsOpen: boolean;
  logOpen: boolean; onChronicle: () => void; canMulligan: boolean; canKeep: boolean; keepLabel: string; onTurn: () => void; onPreviousTurn: () => void; onDraw: () => void; onMulligan: () => void; onKeep: () => void; onUntap: () => void; onFitAll: () => void; onActions: (anchor: HTMLButtonElement) => void;
}) {
  return <nav className="quick-actions" aria-label="Ações rápidas">
    {canMulligan && <button className="secondary bar-action mulligan-action" disabled={disabled} onClick={onMulligan}><TableIcon name="shuffle" /><span>Mulligan</span></button>}
    {canKeep && <button className="secondary bar-action keep-hand-action" disabled={disabled} title={keepLabel} onClick={onKeep}><TableIcon name="hand" /><span>Manter mão</span></button>}
    <button className="secondary bar-action draw-action" disabled={disabled || !canDraw} aria-label="Comprar" title="Comprar uma carta (D)" aria-keyshortcuts="D" onClick={onDraw}><span className="draw-icon" aria-hidden="true"><span style={{ maskImage: `url(${drawIcon})` }} /></span><kbd aria-hidden="true">D</kbd></button>
    <button className="secondary bar-action untap-action" disabled={disabled} aria-label="Desvirar" title="Desvirar todas as permanentes (U)" aria-keyshortcuts="U" onClick={onUntap}><TableIcon name="untap" /><kbd aria-hidden="true">U</kbd></button>
    <button type="button" className="secondary bar-action fit-all-action" aria-label="Ajustar todos os campos" title="Mostrar todas as cartas em todos os campos" onClick={onFitAll}><TableIcon name="focus" /></button>
    <button type="button" className="actions-toggle secondary bar-action" aria-label="Ações" aria-expanded={actionsOpen} onClick={event => onActions(event.currentTarget)}><TableIcon name="more" /></button>
    <div className="turn-control" role="group" aria-label="Turno"><button className="turn-previous" disabled={disabled} aria-label="Corrigir turno" title="Voltar ao jogador anterior" onClick={onPreviousTurn}><TableIcon name="turn-previous" /></button><button className="turn-action" disabled={disabled} aria-label="Passar turno" title="Passar turno (N)" aria-keyshortcuts="N" onClick={onTurn}><span>Turno</span><TableIcon name="turn-next" /></button></div>
    <button type="button" className="secondary bar-action chronicle-toggle" aria-expanded={logOpen} aria-controls="log-panel-content" aria-label={logOpen ? 'Fechar crônica' : 'Abrir crônica'} title={logOpen ? 'Fechar crônica' : 'Abrir crônica'} onClick={onChronicle}><TableIcon name="log" /></button>
  </nav>;
}
