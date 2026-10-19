import { useEffect, useRef, useState } from 'react';
import { MarkerRows, QuantityAdjust } from './CounterControls';
import type { CounterAction, Markers } from './roomsApi';

type Screen = 'menu' | 'draw' | 'roll' | 'life' | 'markers';

type Props = {
  open: boolean;
  count: number;
  sides: number;
  busy: boolean;
  unconfirmed: boolean;
  consultationActive: boolean;
  life: number;
  markers?: Markers;
  playerId: number;
  onCount: (count: number) => void;
  onSides: (sides: number) => void;
  onDraw: () => void;
  onRoll: () => void;
  onCoin: () => void;
  onTurn: (direction: 'next' | 'previous') => void;
  onShuffle: () => void;
  onLibrary: () => void;
  onCounter: (input: CounterAction) => Promise<boolean>;
  onClose: () => void;
  onCreate: () => void;
};

export function GameActions({ open, count, sides, busy, unconfirmed, consultationActive, life, markers, playerId, onCount, onSides, onDraw, onRoll, onCoin, onTurn, onShuffle, onLibrary, onCounter, onClose, onCreate }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [screen, setScreen] = useState<Screen>('menu');
  const canAct = !busy && !unconfirmed;
  const canDraw = canAct && Number.isInteger(count) && count >= 1;
  const canRoll = canAct && Number.isInteger(sides) && sides >= 2 && sides <= 100;
  const opened = open ? screen : '';
  const title = { menu: 'Ações do jogo', draw: 'Comprar cartas', roll: 'Rolar dado', life: 'Vida', markers: 'Marcadores' }[screen];

  useEffect(() => {
    if (open) return;
    setScreen('menu');
  }, [open]);

  // Foca o fechar só quando a tela abre. O polling e uma nova identidade de onClose não recentram o foco.
  useEffect(() => {
    if (!opened) return;
    const input = closeRef.current?.closest('[role="dialog"]')?.querySelector<HTMLInputElement>('input');
    if (input) input.focus(); else closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  if (!open) return null;
  const back = () => setScreen('menu');
  return <div className="actions-panel" role="dialog" aria-label="Ações do jogo">
    <header>
      {screen !== 'menu' && <button type="button" className="secondary panel-back" onClick={back}>Voltar</button>}
      <h2>{title}</h2>
      <button ref={closeRef} type="button" className="secondary panel-close" aria-label="Fechar ações" onClick={onClose}>×</button>
    </header>
    {screen === 'menu' && <div className="actions-grid">
      <button type="button" disabled={!canAct} onClick={() => setScreen('draw')}>Comprar cartas</button>
      <button type="button" disabled={!canAct} onClick={() => setScreen('roll')}>Rolar dado</button>
      <button type="button" disabled={!canAct} onClick={onCoin}>Jogar moeda</button>
      <button type="button" disabled={!canAct} title="Passar turno e ocultar todas as reveladas (N)" aria-keyshortcuts="N" onClick={() => onTurn('next')}>Passar turno</button>
      <button type="button" disabled={!canAct} onClick={() => onTurn('previous')}>Corrigir turno</button>
      <button type="button" aria-label="Grimório" onClick={onLibrary}>Grimório{consultationActive && <small className="consultation-pending" aria-hidden="true">Consulta em andamento</small>}</button>
      {!consultationActive && <button type="button" disabled={!canAct} onClick={onShuffle}>Embaralhar grimório</button>}
      <button type="button" disabled={!canAct} onClick={() => setScreen('life')}>Vida</button>
      <button type="button" disabled={!canAct} onClick={() => setScreen('markers')}>Marcadores</button>
      <button type="button" disabled={!canAct} onClick={onCreate}>Criar ficha</button>
    </div>}
    {screen === 'draw' && <div className="draw-row">
      <span>Comprar cartas</span>
      <div className="draw-stepper">
        <button type="button" className="secondary" aria-label="Diminuir quantidade" disabled={count <= 1} onClick={() => onCount(count - 1)}>−</button>
        <input aria-label="Quantidade para comprar" type="number" min="1" value={count} onChange={event => onCount(Number(event.target.value))} />
        <button type="button" className="secondary" aria-label="Aumentar quantidade" onClick={() => onCount(count + 1)}>+</button>
      </div>
      <button type="button" disabled={!canDraw} onClick={onDraw}>Comprar cartas</button>
    </div>}
    {screen === 'roll' && <div className="draw-row">
      <span>Rolar dado</span>
      <div className="draw-stepper">
        <button type="button" className="secondary" aria-label="Diminuir faces" disabled={sides <= 2} onClick={() => onSides(sides - 1)}>−</button>
        <input aria-label="Faces do dado" type="number" min="2" max="100" value={sides} onChange={event => onSides(Number(event.target.value))} />
        <button type="button" className="secondary" aria-label="Aumentar faces" disabled={sides >= 100} onClick={() => onSides(sides + 1)}>+</button>
      </div>
      <button type="button" disabled={!canRoll} onClick={onRoll}>Rolar dado</button>
    </div>}
    {screen === 'life' && <QuantityAdjust label="vida" value={life} disabled={!canAct} onApply={(operation, value) => onCounter({ target: 'player', playerId, subject: 'life', operation, value })} />}
    {screen === 'markers' && <MarkerRows markers={markers} disabled={!canAct} onApply={(color, operation, value) => onCounter({ target: 'player', playerId, subject: 'marker', color, operation, value })} />}
  </div>;
}
