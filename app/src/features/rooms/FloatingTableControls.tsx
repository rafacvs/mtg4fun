import { TableIcon } from './TableIcon';

export function FloatingTableControls({ handOpen, commandsOpen, informationOpen, handCount, unreadLog, onHand, onCommands, onInformation }: {
  handOpen: boolean; commandsOpen: boolean; informationOpen: boolean; handCount: number; unreadLog: boolean;
  onHand: () => void; onCommands: () => void; onInformation: () => void;
}) {
  return <nav className="floating-table-controls" aria-label="Controles da mesa">
    <button type="button" className="secondary" aria-label="Mão" title="Mostrar ou esconder mão" aria-expanded={handOpen} aria-controls="own-dock-content" onClick={onHand}><TableIcon name="hand" /><small>{handCount}</small></button>
    <button type="button" className="secondary" aria-label="Comandos" title="Comandos da partida" aria-expanded={commandsOpen} aria-controls="mobile-commands" onClick={onCommands}><TableIcon name="actions" /></button>
    <button type="button" className="secondary" aria-label="Informações" title="Prévia, jogadores e registro" aria-expanded={informationOpen} aria-controls="match-rail" onClick={onInformation}><TableIcon name="grid" />{unreadLog && <span className="unread-dot" aria-label="Novas ações no registro" />}</button>
  </nav>;
}
