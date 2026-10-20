import { useEffect, useRef, useState } from 'react';
import { MarkerRows, QuantityAdjust, markerColors, markerValue } from './CounterControls';
import { MenuItem, PanelFeedback, PanelHeader, TablePanel, type PanelFeedbackProps } from './TablePanel';
import type { CounterAction, Match } from './roomsApi';

export function PlayerMenu({ player, viewerId, anchor, disabled, onCounter, onClose, ...feedback }: PanelFeedbackProps & {
  player: Match['players'][number] | undefined; viewerId: number; anchor: HTMLElement | null;
  disabled: boolean; onCounter: (input: CounterAction) => Promise<boolean>; onClose: () => void;
}) {
  const [screen, setScreen] = useState<'menu' | 'life' | 'markers'>('menu');
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => setScreen('menu'), [player?.userId]);
  useEffect(() => { content.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); }, [screen]);
  if (!player) return null;
  const own = viewerId === player.userId;
  return <TablePanel open label={`Jogador ${player.name}`} anchor={anchor} className="player-menu" onClose={onClose}>
    <PanelHeader title={screen === 'life' ? 'Vida' : screen === 'markers' ? 'Marcadores' : player.name} subtitle={own ? 'Seu jogador' : 'Jogador · Somente leitura'} onClose={onClose} closeLabel="Fechar jogador" onBack={screen !== 'menu' ? () => setScreen('menu') : undefined} />
    <PanelFeedback {...feedback} />
    {screen === 'menu' && <div className="table-menu">
      <div className="player-life-readout"><span>Vida</span><strong>{player.life}</strong></div>
      {own ? <>
        <MenuItem icon="heart" title="Vida" description="Ajustar seu total de vida" onClick={() => setScreen('life')} />
        <MenuItem icon="markers" title="Marcadores" description="Seus cinco marcadores de cor" onClick={() => setScreen('markers')} />
      </> : <div className="player-public-markers"><p>Marcadores públicos</p><div className="marker-dots">{markerColors.map(item => <span key={item.color} className={`marker-dot marker-${item.color}`} aria-label={`marcador ${item.name}`}>{markerValue(player.markers, item.color)}</span>)}</div></div>}
    </div>}
    <div ref={content}>
      {own && screen === 'life' && <QuantityAdjust label="vida" value={player.life} disabled={disabled} onApply={(operation, value) => onCounter({ target: 'player', playerId: player.userId, subject: 'life', operation, value })} />}
      {own && screen === 'markers' && <MarkerRows markers={player.markers} disabled={disabled} onApply={(color, operation, value) => onCounter({ target: 'player', playerId: player.userId, subject: 'marker', color, operation, value })} />}
    </div>
  </TablePanel>;
}
