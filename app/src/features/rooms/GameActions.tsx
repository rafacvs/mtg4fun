import { useEffect, useState } from 'react';
import { CreateInstances } from './CreateInstances';
import { FinishMatch } from './FinishMatch';
import { TurnOrder } from './TurnOrder';
import { TableIcon } from './TableIcon';
import { GameActionFooter } from './GameActionFooter';
import { MenuItem, PanelFeedback, PanelHeader, PanelResult, TablePanel, type PanelFeedbackProps } from './TablePanel';
import type { CustomToken, Match } from './roomsApi';
import './game-actions.css';

const defaultSides = 20;

export type GameActionsScreen = 'menu' | 'roll' | 'coin' | 'token';

const headers: Record<GameActionsScreen, { title: string; subtitle: string; parent?: GameActionsScreen }> = {
  menu: { title: 'Ações do jogo', subtitle: 'Mesa manual' },
  roll: { title: 'Rolar dado', subtitle: 'Ações do jogo', parent: 'menu' },
  coin: { title: 'Jogar moeda', subtitle: 'Ações do jogo', parent: 'menu' },
  token: { title: 'Criar ficha', subtitle: 'Ações do jogo', parent: 'menu' },
};

type Props = PanelFeedbackProps & {
  open: boolean; anchor: HTMLElement | null; initialScreen: GameActionsScreen; roomId: number; actorName: string;
  sides: number; busy: boolean; unconfirmed: boolean;
  onSides: (sides: number) => void; onRoll: () => void; onCoin: () => void;
  onClose: () => void;
  onCreateToken: (name: string) => Promise<boolean>; onCreateCustom: (token: CustomToken) => Promise<boolean>;
  result?: string; resultKind?: string;
  match: Match; onFinish: () => Promise<boolean>;
};

export function GameActions({ open, anchor, initialScreen, roomId, actorName, sides, busy, unconfirmed, onSides, onRoll, onCoin, onClose, onCreateToken, onCreateCustom, result, resultKind, error, onRetry, match, onFinish }: Props) {
  const [screen, setScreen] = useState<GameActionsScreen>(initialScreen);
  const [coinSide, setCoinSide] = useState<'Cara' | 'Coroa'>('Cara');
  const canAct = !busy && !unconfirmed;
  const validSides = Number.isInteger(sides) && sides >= 2 && sides <= 100;
  const header = headers[screen];
  useEffect(() => { setScreen(open ? initialScreen : 'menu'); }, [open, initialScreen]);
  return (
    <TablePanel open={open} anchor={anchor} align="above" fitViewport label="Ações do jogo" className={`game-actions game-actions-${screen}`} onClose={onClose}>
      <PanelHeader title={header.title} subtitle={header.subtitle} onClose={onClose} closeLabel="Fechar ações" />
      <PanelFeedback error={error} busy={busy} unconfirmed={unconfirmed} onRetry={onRetry} />
      {screen === 'menu' && <div className="table-menu actions-grid">
        <section className="game-turn-section" aria-label="Turno"><TurnOrder match={match} /></section>
        <section className="game-action-section" aria-label="Ações"><h3>Ações</h3><div className="game-action-tiles">
          <MenuItem icon="menu-dice" title="Rolar dado" description="Escolher o número de faces" disabled={!canAct} onClick={() => setScreen('roll')} />
          <MenuItem icon="menu-coin" title="Jogar moeda" description="Cara ou coroa" disabled={!canAct} onClick={() => setScreen('coin')} />
          <MenuItem icon="menu-token" title="Criar ficha" description="Do catálogo ou personalizada" disabled={!canAct} onClick={() => setScreen('token')} />
        </div></section>
        <div className="game-exit-divider" aria-hidden="true"><span>◇</span></div>
        <div className="game-exit-actions">
          <a href="/#/salas" className="game-lobby-link"><TableIcon name="back" /><span>Lobby</span></a>
          <FinishMatch match={match} busy={busy} unconfirmed={unconfirmed} error={error} onConfirm={onFinish} onRetry={onRetry} />
        </div>
      </div>}
      {screen === 'roll' && <div className="panel-form dice-form">
        <div className="dice-roll">
          <DieFace sides={sides} />
          <div className="dice-sides">
            <label htmlFor="dice-sides">Faces do dado</label>
            <div className="draw-stepper">
              <button type="button" className="secondary" aria-label="Diminuir faces" disabled={!canAct || sides <= 2} onClick={() => onSides(sides - 1)}>−</button>
              <input id="dice-sides" aria-label="Faces do dado" type="number" min="2" max="100" value={sides} data-changed={sides !== defaultSides} onChange={event => onSides(Number(event.target.value))} />
              <button type="button" className="secondary" aria-label="Aumentar faces" disabled={!canAct || sides >= 100} onClick={() => onSides(sides + 1)}>+</button>
            </div>
          </div>
        </div>
        <p className="dice-range">{validSides ? `Sorteia um número de 1 a ${sides}.` : 'Escolha entre 2 e 100 faces.'}</p>
        {result && resultKind === 'roll' && <PanelResult>{result}</PanelResult>}
        <GameActionFooter onCancel={() => setScreen('menu')} disabled={!canAct || !validSides} onConfirm={onRoll} label={validSides ? `Rolar d${sides}` : 'Rolar dado'} />
      </div>}
      {screen === 'coin' && <div className="coin-form"><h3>Escolha um lado</h3><div className="coin-options" role="group" aria-label="Escolha um lado">
        {(['Cara', 'Coroa'] as const).map(side => <button type="button" key={side} className="coin-option" aria-pressed={coinSide === side} onClick={() => setCoinSide(side)}><span className="coin-disc"><TableIcon name={side === 'Cara' ? 'coin-sun' : 'crown'} /></span><strong>{side}</strong></button>)}
      </div><p>Você escolheu {coinSide}.</p>{result && resultKind === 'coin' && <PanelResult>{result}</PanelResult>}<GameActionFooter onCancel={() => setScreen('menu')} disabled={!canAct} onConfirm={onCoin} label="Jogar moeda" /></div>}
      {screen === 'token' && <CreateInstances roomId={roomId} busy={!canAct} actorName={actorName} onCancel={() => setScreen('menu')} onCreateToken={onCreateToken} onCreateCustom={onCreateCustom} />}
    </TablePanel>
  );
}

function DieFace({ sides }: { sides: number }) {
  return <span className="die-face" aria-label={`Dado de ${sides} faces`} role="img">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 4 90 27v46L50 96 10 73V27Z" />
      <path d="M50 24 80 70H20Z M50 4v20M10 27l40-3M90 27l-40-3M10 27l10 43M90 27l-10 43M10 73l10-3M90 73l-10-3M50 96 20 70M50 96l30-26" />
    </svg>
    <strong>D{sides}</strong>
  </span>;
}
