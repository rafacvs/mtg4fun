import { useEffect, useRef } from 'react';

const laterActions = ['Desvirar todas', 'Contadores'];

type Props = {
  open: boolean;
  count: number;
  sides: number;
  busy: boolean;
  unconfirmed: boolean;
  consultationActive: boolean;
  onCount: (count: number) => void;
  onSides: (sides: number) => void;
  onDraw: () => void;
  onRoll: () => void;
  onCoin: () => void;
  onTurn: (direction: 'next' | 'previous') => void;
  onShuffle: () => void;
  onLibrary: () => void;
  onClose: () => void;
  onCreate: () => void;
};

export function GameActions({ open, count, sides, busy, unconfirmed, consultationActive, onCount, onSides, onDraw, onRoll, onCoin, onTurn, onShuffle, onLibrary, onClose, onCreate }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const canAct = !busy && !unconfirmed;
  const canDraw = canAct && Number.isInteger(count) && count >= 1;
  const canRoll = canAct && Number.isInteger(sides) && sides >= 2 && sides <= 100;

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
      <div className="draw-row">
        <span>Rolar dado</span>
        <div className="draw-stepper">
          <button type="button" className="secondary" aria-label="Diminuir faces" disabled={sides <= 2} onClick={() => onSides(sides - 1)}>−</button>
          <input aria-label="Faces do dado" type="number" min="2" max="100" value={sides} onChange={event => onSides(Number(event.target.value))} />
          <button type="button" className="secondary" aria-label="Aumentar faces" disabled={sides >= 100} onClick={() => onSides(sides + 1)}>+</button>
        </div>
        <button type="button" disabled={!canRoll} onClick={onRoll}>Rolar dado</button>
      </div>
      <div className="actions-grid">
        {consultationActive
          ? <button type="button" onClick={onLibrary}>Retomar consulta do grimório</button>
          : <button type="button" disabled={!canAct} onClick={onShuffle}>Embaralhar grimório</button>}
        <button type="button" disabled={!canAct} onClick={onCoin}>Jogar moeda</button>
        <button type="button" disabled={!canAct} onClick={() => onTurn('next')}>Avançar turno</button>
        <button type="button" disabled={!canAct} onClick={() => onTurn('previous')}>Corrigir turno</button>
        <button type="button" disabled={!canAct} onClick={onCreate}>Criar ficha</button>
        {laterActions.map(action => <button type="button" key={action} disabled>{action}</button>)}
      </div>
    </div>;
}
