import { useEffect, useRef } from 'react';
import { MarkerColumns, NumericCounter, markerColors, markerValue } from './CounterControls';
import { PanelFeedback, PanelHeader, TablePanel, type PanelFeedbackProps } from './TablePanel';
import type { CounterAction, Match } from './roomsApi';

export function PlayerMenu({ player, viewerId, anchor, disabled, onCounter, onClose, ...feedback }: PanelFeedbackProps & {
  player: Match['players'][number] | undefined; viewerId: number; anchor: HTMLElement | null;
  disabled: boolean; onCounter: (input: CounterAction) => Promise<boolean>; onClose: () => void;
}) {
  const life = useRef<HTMLDivElement>(null);
  useEffect(() => { life.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); }, [player?.userId]);
  if (!player) return null;
  const own = viewerId === player.userId;
  const counted = markerColors.filter(item => markerValue(player.markers, item.color) !== 0);
  return <TablePanel open label={`Jogador ${player.name}`} anchor={anchor} align="start" className="player-menu" onClose={onClose}>
    <PanelHeader title={player.name} subtitle={own ? 'Seu jogador' : 'Jogador · Somente leitura'} onClose={onClose} closeLabel="Fechar jogador" />
    <PanelFeedback {...feedback} />
    {own ? <>
      <section className="panel-block">
        <p className="panel-label">Vida</p>
        <div ref={life} className="life-stepper">
          <NumericCounter label="vida" inputLabel="Vida" textual value={player.life} disabled={disabled} onApply={(operation, value) => onCounter({ target: 'player', playerId: player.userId, subject: 'life', operation, value })} />
        </div>
      </section>
      <section className="panel-block" aria-label="Marcadores de cor">
        <p className="panel-label">Marcadores de cor</p>
        <MarkerColumns markers={player.markers} disabled={disabled} onApply={(color, operation, value) => onCounter({ target: 'player', playerId: player.userId, subject: 'marker', color, operation, value })} />
      </section>
    </> : <>
      <section className="panel-block">
        <p className="panel-label">Vida</p>
        <strong className="life-readout">{player.life}</strong>
      </section>
      <section className="panel-block">
        <p className="panel-label">Marcadores de cor</p>
        {counted.length
          ? <div className="marker-preview">{counted.map(item => <span key={item.color}><span className={`marker-gem marker-${item.color}`} aria-hidden="true" /><span aria-label={`marcador ${item.name}`}>{markerValue(player.markers, item.color)}</span></span>)}</div>
          : <p className="panel-hint">Nenhum marcador</p>}
      </section>
    </>}
  </TablePanel>;
}
