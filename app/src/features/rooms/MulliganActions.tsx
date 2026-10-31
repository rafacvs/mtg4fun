import { TableIcon } from './TableIcon';

export function MulliganActions({ className, kept, canMulligan, disabled, consulting, waiting, onMulligan, onKeep, onUndo }: {
  className: string; kept: boolean; canMulligan: boolean; disabled: boolean; consulting: boolean; waiting: string[];
  onMulligan: () => void; onKeep: () => void; onUndo: () => void;
}) {
  return <nav className={className} aria-label="Confirmação da mão">
    {waiting.length > 0 && <span className="mulligan-waiting" role="status">Falta confirmar: {waiting.join(', ')}</span>}
    {canMulligan && <button className="secondary bar-action mulligan-action" disabled={disabled} onClick={onMulligan}><TableIcon name="shuffle" /><span>Mulligan</span></button>}
    {kept
      ? <button className="secondary bar-action keep-hand-action" disabled={disabled} onClick={onUndo}><TableIcon name="hand" /><span>Desconfirmar mão</span></button>
      : <button className="bar-action keep-hand-action" disabled={disabled || consulting} title={consulting ? 'Feche a consulta do grimório antes de confirmar' : undefined} onClick={onKeep}><TableIcon name="hand" /><span>Confirmar mão</span></button>}
  </nav>;
}
