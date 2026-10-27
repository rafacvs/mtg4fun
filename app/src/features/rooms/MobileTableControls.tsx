import type { Ref } from 'react';
import { TableIcon } from './TableIcon';

export function MobileTableControls({ moreOpen, canDraw, disabled, moreRef, onDraw, onUntap, onTurn, onMore }: {
  moreOpen: boolean; canDraw: boolean; disabled: boolean; moreRef?: Ref<HTMLButtonElement>;
  onDraw: () => void; onUntap: () => void; onTurn: () => void; onMore: () => void;
}) {
  return <nav className="mobile-table-controls" aria-label="Controles da mesa">
    <button aria-label="Comprar" title="Comprar" disabled={disabled || !canDraw} onClick={onDraw}><TableIcon name="draw" /></button>
    <button className="secondary" disabled={disabled} onClick={onUntap}>Desvirar</button>
    <button className="secondary" disabled={disabled} onClick={onTurn}>Passar turno</button>
    <button ref={moreRef} className="secondary" aria-expanded={moreOpen} aria-controls="mobile-commands" onClick={onMore}>Mais</button>
  </nav>;
}
