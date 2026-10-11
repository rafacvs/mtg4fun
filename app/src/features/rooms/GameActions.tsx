import { useEffect, useRef } from 'react';

const laterActions = ['Embaralhar grimório', 'Desvirar todas', 'Rolar dado', 'Jogar moeda', 'Contadores', 'Criar ficha'];

type Props = {
  open: boolean;
  count: number;
  busy: boolean;
  unconfirmed: boolean;
  onCount: (count: number) => void;
  onDraw: () => void;
  onClose: () => void;
};

export function GameActions({ open, count, busy, unconfirmed, onCount, onDraw, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const canDraw = !busy && !unconfirmed && Number.isInteger(count) && count >= 1;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return <div className="actions-panel" role="dialog" aria-label="Ações do jogo">
      <header>
        <div><p className="actions-kicker">Ações</p><h2>Ações do jogo</h2></div>
        <button ref={closeRef} type="button" className="secondary" aria-label="Fechar ações" onClick={onClose}>×</button>
      </header>
      <div className="draw-row">
        <span>Comprar cartas</span>
        <div className="draw-stepper">
          <button type="button" className="secondary" aria-label="Diminuir quantidade" disabled={count <= 1} onClick={() => onCount(count - 1)}>−</button>
          <input aria-label="Quantidade para comprar" type="number" min="1" value={count} onChange={event => onCount(Number(event.target.value))} />
          <button type="button" className="secondary" aria-label="Aumentar quantidade" onClick={() => onCount(count + 1)}>+</button>
        </div>
        <button type="button" disabled={!canDraw} onClick={onDraw}>Comprar cartas</button>
      </div>
      <div className="actions-grid">
        {laterActions.map(action => <button type="button" key={action} disabled>{action}</button>)}
      </div>
    </div>;
}
