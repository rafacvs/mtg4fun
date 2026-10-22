import { useEffect, useState } from 'react';
import { MenuItem, PanelFeedback, PanelHeader, TablePanel, type PanelFeedbackProps } from './TablePanel';

type Props = PanelFeedbackProps & {
  open: boolean; anchor: HTMLElement | null; sides: number; busy: boolean; unconfirmed: boolean;
  onSides: (sides: number) => void; onRoll: () => void; onCoin: () => void;
  onTurn: (direction: 'next' | 'previous') => void; onClose: () => void; onCreate: () => void;
  result?: string;
};

export function GameActions({ open, anchor, sides, busy, unconfirmed, onSides, onRoll, onCoin, onTurn, onClose, onCreate, result, error, onRetry }: Props) {
  const [screen, setScreen] = useState<'menu' | 'roll'>('menu');
  const canAct = !busy && !unconfirmed;
  useEffect(() => { if (!open) setScreen('menu'); }, [open]);
  return <TablePanel open={open} anchor={anchor} label="Ações do jogo" onClose={onClose}>
    <PanelHeader title={screen === 'roll' ? 'Rolar dado' : 'Ações do jogo'} subtitle="Mesa manual" onClose={onClose} closeLabel="Fechar ações" onBack={screen !== 'menu' ? () => setScreen('menu') : undefined} />
    <PanelFeedback error={error} busy={busy} unconfirmed={unconfirmed} onRetry={onRetry} />
    {screen === 'menu' && <div className="table-menu actions-grid">
      <MenuItem icon="dice" title="Rolar dado" description="Escolher o número de faces" disabled={!canAct} onClick={() => setScreen('roll')} />
      <MenuItem icon="coin" title="Jogar moeda" description="Cara ou coroa" disabled={!canAct} onClick={onCoin} />
      <MenuItem icon="token" title="Criar ficha" description="Do catálogo ou personalizada" disabled={!canAct} onClick={onCreate} />
      <MenuItem icon="previous" title="Corrigir turno" description="Voltar ao jogador anterior" disabled={!canAct} onClick={() => onTurn('previous')} />
    </div>}
    {screen === 'roll' && <div className="panel-form">
      <label htmlFor="dice-sides">Faces do dado</label>
      <div className="draw-stepper">
        <button type="button" className="secondary" aria-label="Diminuir faces" disabled={!canAct || sides <= 2} onClick={() => onSides(sides - 1)}>−</button>
        <input id="dice-sides" aria-label="Faces do dado" type="number" min="2" max="100" value={sides} onChange={event => onSides(Number(event.target.value))} />
        <button type="button" className="secondary" aria-label="Aumentar faces" disabled={!canAct || sides >= 100} onClick={() => onSides(sides + 1)}>+</button>
      </div>
      <button type="button" disabled={!canAct || !Number.isInteger(sides) || sides < 2 || sides > 100} onClick={onRoll}>Rolar dado</button>
    </div>}
    {result && <p role="status" className="panel-result">{result}</p>}
  </TablePanel>;
}
