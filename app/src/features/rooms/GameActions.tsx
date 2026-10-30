import { useEffect, useState } from 'react';
import { CreateInstances } from './CreateInstances';
import { MenuItem, PanelFeedback, PanelHeader, PanelResult, TablePanel, type PanelFeedbackProps } from './TablePanel';
import type { CustomToken } from './roomsApi';

const defaultSides = 20;

export type GameActionsScreen = 'menu' | 'roll' | 'token';

const headers: Record<GameActionsScreen, { title: string; subtitle: string; parent?: GameActionsScreen }> = {
  menu: { title: 'Ações do jogo', subtitle: 'Mesa manual' },
  roll: { title: 'Rolar dado', subtitle: 'Ações do jogo', parent: 'menu' },
  token: { title: 'Criar ficha', subtitle: 'Ações do jogo', parent: 'menu' },
};

type Props = PanelFeedbackProps & {
  open: boolean; anchor: HTMLElement | null; initialScreen: GameActionsScreen; roomId: number; actorName: string;
  sides: number; busy: boolean; unconfirmed: boolean;
  onSides: (sides: number) => void; onRoll: () => void; onCoin: () => void;
  onTurn: (direction: 'next' | 'previous') => void; onClose: () => void;
  onCreateToken: (name: string) => Promise<boolean>; onCreateCustom: (token: CustomToken) => Promise<boolean>;
  result?: string; lastRoll?: number;
};

export function GameActions({ open, anchor, initialScreen, roomId, actorName, sides, busy, unconfirmed, onSides, onRoll, onCoin, onTurn, onClose, onCreateToken, onCreateCustom, result, lastRoll, error, onRetry }: Props) {
  const [screen, setScreen] = useState<GameActionsScreen>(initialScreen);
  const canAct = !busy && !unconfirmed;
  const validSides = Number.isInteger(sides) && sides >= 2 && sides <= 100;
  const header = headers[screen];
  useEffect(() => { setScreen(open ? initialScreen : 'menu'); }, [open, initialScreen]);
  return (
    <TablePanel open={open} anchor={anchor} align="above" label="Ações do jogo" className={`game-actions game-actions-${screen}`} onClose={onClose}>
      <PanelHeader title={header.title} subtitle={header.subtitle} onClose={onClose} closeLabel="Fechar ações" onBack={header.parent ? () => setScreen(header.parent!) : undefined} />
      <PanelFeedback error={error} busy={busy} unconfirmed={unconfirmed} onRetry={onRetry} />
      {screen === 'menu' && <div className="table-menu actions-grid">
        <MenuItem icon="dice" title="Rolar dado" description="Escolher o número de faces" disabled={!canAct} onClick={() => setScreen('roll')} />
        <MenuItem icon="coin" title="Jogar moeda" description="Cara ou coroa" disabled={!canAct} opens={false} onClick={onCoin} />
        <MenuItem icon="token" title="Criar ficha" description="Do catálogo ou personalizada" disabled={!canAct} onClick={() => setScreen('token')} />
        <MenuItem icon="previous" title="Corrigir turno" description="Voltar ao jogador anterior" disabled={!canAct} opens={false} onClick={() => onTurn('previous')} />
      </div>}
      {screen === 'roll' && <div className="panel-form dice-form">
        <div className="dice-roll">
          <DieFace value={lastRoll} />
          <div className="dice-sides">
            <label htmlFor="dice-sides">Faces do dado</label>
            <div className="draw-stepper">
              <button type="button" className="secondary" aria-label="Diminuir faces" disabled={!canAct || sides <= 2} onClick={() => onSides(sides - 1)}>−</button>
              <input id="dice-sides" aria-label="Faces do dado" type="number" min="2" max="100" value={sides} data-changed={sides !== defaultSides} onChange={event => onSides(Number(event.target.value))} />
              <button type="button" className="secondary" aria-label="Aumentar faces" disabled={!canAct || sides >= 100} onClick={() => onSides(sides + 1)}>+</button>
            </div>
          </div>
        </div>
        <button type="button" className="panel-primary" disabled={!canAct || !validSides} onClick={onRoll}>{validSides ? `Rolar d${sides}` : 'Rolar dado'}</button>
      </div>}
      {screen === 'token' && <CreateInstances roomId={roomId} busy={!canAct} actorName={actorName} onCreateToken={onCreateToken} onCreateCustom={onCreateCustom} />}
      {result && screen !== 'token' && <PanelResult>{result}</PanelResult>}
    </TablePanel>
  );
}

function DieFace({ value }: { value?: number }) {
  return <span className="die-face" aria-label={value === undefined ? 'Nenhuma rolagem ainda' : `Última rolagem: ${value}`} role="img">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 4 90 27v46L50 96 10 73V27Z" />
      <path d="M50 24 80 70H20Z M50 4v20M10 27l40-3M90 27l-40-3M10 27l10 43M90 27l-10 43M10 73l10-3M90 73l-10-3M50 96 20 70M50 96l30-26" />
    </svg>
    <strong>{value ?? '–'}</strong>
  </span>;
}
