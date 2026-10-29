import type { Ref } from 'react';
import { TableIcon } from './TableIcon';

export function MobileTableControls({ moreOpen, moreRef, onMore, disabled, canMulligan, canKeep, keepLabel, onMulligan, onKeep }: {
  moreOpen: boolean; moreRef?: Ref<HTMLButtonElement>; onMore: () => void;
  disabled: boolean; canMulligan: boolean; canKeep: boolean; keepLabel: string; onMulligan: () => void; onKeep: () => void;
}) {
  return <nav className="mobile-table-controls" aria-label="Controles da mesa">
    {canMulligan && <button className="secondary mulligan-action" disabled={disabled} onClick={onMulligan}><TableIcon name="shuffle" /><span>Mulligan</span></button>}
    {canKeep && <button className="secondary keep-hand-action" disabled={disabled} title={keepLabel} onClick={onKeep}><TableIcon name="hand" /><span>Manter mão</span></button>}
    <button ref={moreRef} className="secondary" aria-label="Comandos" title="Comandos" aria-expanded={moreOpen} aria-controls="mobile-commands" onClick={onMore}><TableIcon name="actions" /></button>
  </nav>;
}
