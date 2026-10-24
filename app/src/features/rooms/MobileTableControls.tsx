import type { Ref } from 'react';

export function MobileTableControls({ handOpen, moreOpen, canDraw, disabled, moreRef, onHand, onDraw, onUntap, onTurn, onMore }: {
  handOpen: boolean; moreOpen: boolean; canDraw: boolean; disabled: boolean; moreRef?: Ref<HTMLButtonElement>;
  onHand: () => void; onDraw: () => void; onUntap: () => void; onTurn: () => void; onMore: () => void;
}) {
  return <nav className="mobile-table-controls" aria-label="Controles da mesa">
    <button className="secondary" aria-expanded={handOpen} aria-controls="own-dock-content" onClick={onHand}>Mão</button>
    <button disabled={disabled || !canDraw} onClick={onDraw}>Comprar</button>
    <button className="secondary" disabled={disabled} onClick={onUntap}>Desvirar</button>
    <button className="secondary" disabled={disabled} onClick={onTurn}>Passar a vez</button>
    <button ref={moreRef} className="secondary" aria-expanded={moreOpen} aria-controls="mobile-commands" onClick={onMore}>Mais</button>
  </nav>;
}
