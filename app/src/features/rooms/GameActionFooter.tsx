import { TableIcon } from './TableIcon';

export function GameActionFooter({ onCancel, onConfirm, disabled, label, cancelLabel = 'Cancelar', hideDivider = false }: { onCancel: () => void; onConfirm: () => void; disabled: boolean; label: string; cancelLabel?: string; hideDivider?: boolean }) {
  return <div className="game-submenu-footer">{!hideDivider && <div className="game-exit-divider" aria-hidden="true"><span>◇</span></div>}<div className="game-submenu-buttons">
    <button type="button" className="secondary game-cancel" onClick={onCancel}><TableIcon name="back" />{cancelLabel}</button>
    <button type="button" className="panel-primary" disabled={disabled} onClick={onConfirm}>{label}</button>
  </div></div>;
}
