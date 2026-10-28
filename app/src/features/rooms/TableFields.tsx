import type { CSSProperties, ReactNode } from 'react';
import type { Match } from './roomsApi';
import { PlayerTable, type CardGesture } from './PlayerTable';
import { PlayerSeat, seatColors } from './PlayerSeat';
import matForest from '../../assets/theme/mat-forest.jpg';
import matSea from '../../assets/theme/mat-sea.jpg';
import matMountain from '../../assets/theme/mat-mountain.jpg';
import matSwamp from '../../assets/theme/mat-swamp.jpg';

const playmats = [matForest, matSea, matMountain, matSwamp];

export function TableFields({ match, gesture, hoverZone, focusedId, disabled, onPlayerMenu, onFocus, onLibrary, onDraw, onHideRevealed, ownCommands, focusEnabled }: {
  ownCommands?: ReactNode; match: Match; gesture: CardGesture; hoverZone: string | null; disabled: boolean;
  focusEnabled: boolean;
  onPlayerMenu: (id: number, anchor: HTMLElement) => void;
  focusedId: number | null; onFocus: (id: number) => void;
  onLibrary: () => void; onDraw: () => void; onHideRevealed: () => void;
}) {
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const viewerTurnIndex = match.turnOrder.findIndex(player => player.userId === match.viewerId);
  const turnDistance = (id: number) => {
    const index = match.turnOrder.findIndex(player => player.userId === id);
    return index < 0 || viewerTurnIndex < 0 ? match.turnOrder.length : (index - viewerTurnIndex + match.turnOrder.length) % match.turnOrder.length;
  };
  const opponents = match.players.filter(player => player.userId !== match.viewerId)
    .sort((left, right) => turnDistance(left.userId) - turnDistance(right.userId));
  const renderPlayer = (player: Match['players'][number]) => {
    const isOwn = player.userId === match.viewerId;
    const focused = player.userId === focusedId;
    const index = match.players.findIndex(item => item.userId === player.userId);
    const currentTurn = player.userId === match.currentTurn.userId;
    const seat = <PlayerSeat player={player} own={isOwn} currentTurn={currentTurn} focused={focused} focusEnabled={focusEnabled} turnPosition={match.turnOrder.findIndex(item => item.userId === player.userId) + 1} onMenu={anchor => onPlayerMenu(player.userId, anchor)} onFocus={() => onFocus(player.userId)} />;
    return <div key={player.userId} className={`${isOwn ? 'own-table-surface' : 'opponent-table-surface'} ${focused ? 'focused-table-surface' : ''}`} style={{ '--seat-color': seatColors[index % seatColors.length], '--playmat-image': `url(${playmats[index % playmats.length]})` } as CSSProperties}>
      <PlayerTable player={player} focused={focused} expanded={focused} own={isOwn} viewerId={match.viewerId} hoverZone={hoverZone} gesture={gesture} fieldZoom={1} onPlayerMenu={anchor => onPlayerMenu(player.userId, anchor)} currentTurn={currentTurn} onLibrary={isOwn ? onLibrary : undefined} onDraw={isOwn ? onDraw : undefined} onHideRevealed={isOwn ? onHideRevealed : undefined} disabled={disabled} seat={seat} />
      {isOwn && ownCommands}
    </div>;
  };
  const controllerColors = Object.fromEntries(match.players.map((player, index) => [`--seat-${player.userId}`, seatColors[index % seatColors.length]])) as CSSProperties;
  return <div className={`desktop-fields player-count-${match.players.length} ${focusedId ? 'has-field-focus' : ''}`} style={controllerColors}>
    {opponents.length > 0 && <section className="opponent-strip" aria-label="Oponentes" tabIndex={0}>{opponents.map(renderPlayer)}</section>}
    {renderPlayer(own)}
  </div>;
}
