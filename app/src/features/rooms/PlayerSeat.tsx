import { markerColors, markerValue } from './CounterControls';
import { TableIcon } from './TableIcon';
import type { Match } from './roomsApi';

export const seatColors = ['#6cb4f5', '#f27bb0', '#b49af7', '#4fd1b0', '#f2a46f', '#c9cb70'];

export function PlayerSeat({ player, own, turnPosition, currentTurn, focused, onMenu, onFocus, focusEnabled = true }: {
  player: Match['players'][number]; own: boolean; turnPosition: number; currentTurn: boolean; focused: boolean;
  focusEnabled?: boolean;
  onMenu: (anchor: HTMLElement) => void; onFocus: () => void;
}) {
  return <header className="seat-heading">
    <span className="seat-number" title={`Posição na ordem do turno: ${turnPosition}`}>{turnPosition}</span>
    <div className="seat-name">
      <div className="seat-name-line">
        <h2>{player.name}</h2>
        <span className="seat-hand-count" aria-label={`Mão: ${player.handCount} cartas${own ? '' : ', privada'}`} title={`Mão: ${player.handCount} · ${own ? 'Sua mão' : 'Conteúdo privado'}`}>
          <TableIcon name="hand" /><span>{player.handCount}</span>
        </span>
        {markerColors.filter(({ color }) => markerValue(player.markers, color) !== 0).map(({ color, name }) => <span key={color} className={`seat-marker-count seat-marker-${color}`} aria-label={`marcador ${name}`} title={`Marcador ${name}`}><span className="seat-marker-glyph" aria-hidden="true" /><span className="seat-marker-value">{markerValue(player.markers, color)}</span></span>)}
        {currentTurn && <span className="seat-turn" aria-label={own ? "Sua vez" : "Na vez"}>{own ? "Sua vez" : "Na vez"}</span>}
      </div>
      {player.consulting && <div className="seat-status-line">
        {player.consulting && <span role="status" className="seat-activity">Consultando o grimório</span>}
      </div>}
    </div>
    {own ? <div className="seat-life" aria-label={`Vida: ${player.life}`}><strong className="seat-life-mobile" aria-hidden="true">{player.life}</strong></div>
      : <strong className="seat-life-readout" aria-label={`Vida: ${player.life}`}>{player.life}</strong>}
    <button className="seat-markers secondary" aria-label={`Abrir jogador ${player.name}`} title="Vida e marcadores" onClick={event => onMenu(event.currentTarget)} />
    {focusEnabled && <button className="seat-focus secondary" aria-label={focused ? 'Voltar à visão geral' : `Ampliar mesa de ${player.name}`} aria-pressed={focused} title={focused ? 'Voltar à visão geral' : 'Ampliar mesa'} onClick={onFocus}>{focused ? 'Visão geral' : 'Ampliar'}</button>}
  </header>;
}
