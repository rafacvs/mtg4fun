import type { Ref } from 'react';
import { TableIcon } from './TableIcon';

export function MobileTableControls({ moreOpen, moreRef, onMore }: {
  moreOpen: boolean; moreRef?: Ref<HTMLButtonElement>; onMore: () => void;
}) {
  return <nav className="mobile-table-controls" aria-label="Controles da mesa">
    <button ref={moreRef} className="secondary" aria-label="Comandos" title="Comandos" aria-expanded={moreOpen} aria-controls="mobile-commands" onClick={onMore}><TableIcon name="actions" /></button>
  </nav>;
}
