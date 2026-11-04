import { GameLobbyLink } from './GameLobbyLink';
import { PanelHeader, TablePanel } from './TablePanel';
import './game-actions.css';

export function SpectatorActions({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  return <TablePanel open={Boolean(anchor)} anchor={anchor} align="above" fitViewport label="Ações da sala" className="game-actions game-actions-menu spectator-actions" onClose={onClose}>
    <PanelHeader title="Ações da sala" subtitle="Modo espectador" onClose={onClose} closeLabel="Fechar ações" />
    <div className="table-menu actions-grid">
      <div className="game-exit-divider" aria-hidden="true"><span>◇</span></div>
      <div className="game-exit-actions"><GameLobbyLink /></div>
    </div>
  </TablePanel>;
}
