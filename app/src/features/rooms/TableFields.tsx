import type { CSSProperties, ReactNode } from 'react';
import type { CounterAction, Match } from './roomsApi';
import { PlayerTable, type CardGesture } from './PlayerTable';
import { PlayerSeat, seatColors } from './PlayerSeat';

export function TableFields({ match, gesture, hoverZone, disabled, onPlayerMenu, onCounter, onLibrary, onDraw, onHideRevealed, ownCommands }: {
  ownCommands?: ReactNode; match: Match; gesture: CardGesture; hoverZone: string | null; disabled: boolean;
  onPlayerMenu: (id: number, anchor: HTMLElement) => void; onCounter: (input: CounterAction) => Promise<boolean>;
  onLibrary: () => void; onDraw: () => void; onHideRevealed: () => void;
}) {
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const opponents = match.players.filter(player => player.userId !== match.viewerId);
  const renderPlayer = (player: Match['players'][number]) => {
    const isOwn = player.userId === match.viewerId;
    const index = match.players.findIndex(item => item.userId === player.userId);
    const currentTurn = player.userId === match.currentTurn.userId;
    const seat = <PlayerSeat player={player} own={isOwn} currentTurn={currentTurn} turnPosition={match.turnOrder.findIndex(item => item.userId === player.userId) + 1} disabled={disabled} onCounter={onCounter} onMenu={anchor => onPlayerMenu(player.userId, anchor)} />;
    return <div key={player.userId} className={isOwn ? 'own-table-surface' : 'opponent-table-surface'} style={{ '--seat-color': seatColors[index % seatColors.length] } as CSSProperties}>
      <PlayerTable player={player} focused={isOwn} expanded own={isOwn} viewerId={match.viewerId} hoverZone={hoverZone} gesture={gesture} fieldZoom={1} onPlayerMenu={anchor => onPlayerMenu(player.userId, anchor)} currentTurn={currentTurn} onLibrary={isOwn ? onLibrary : undefined} onDraw={isOwn ? onDraw : undefined} onHideRevealed={isOwn ? onHideRevealed : undefined} disabled={disabled} seat={seat} />
      {isOwn && ownCommands}
    </div>;
  };
  const controllerColors = Object.fromEntries(match.players.map((player, index) => [`--seat-${player.userId}`, seatColors[index % seatColors.length]])) as CSSProperties;
  return <div className="desktop-fields" style={controllerColors}>
    {opponents.length > 0 && <section className="opponent-strip" aria-label="Oponentes" tabIndex={0}>{opponents.map(renderPlayer)}</section>}
    {renderPlayer(own)}
  </div>;
}
