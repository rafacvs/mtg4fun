import { useState } from 'react';
import type { Card, Match } from './roomsApi';
import { seatColors } from './PlayerSeat';

export type OwnerDestination = 'hand' | 'graveyard' | 'exile' | 'command' | 'library-top' | 'library-bottom';

export function CardControlTransfer({ card, players, viewerId, disabled, onTransfer, onMoveToOwner }: {
  card: Card;
  players: Match['players'];
  viewerId: number;
  disabled: boolean;
  onTransfer: (cardId: string, controllerId: number) => void;
  onMoveToOwner: (cardId: string, destination: OwnerDestination) => void;
}) {
  const targets = players.filter(player => player.userId !== viewerId);
  const [targetId, setTargetId] = useState('');
  const [destination, setDestination] = useState<OwnerDestination>('graveyard');
  if (card.zone !== 'battlefield' || card.controllerId !== viewerId) return null;
  const owner = players.find(player => player.userId === card.ownerId);
  return <section className="card-control-transfer" aria-label="Controle da carta">
    {targets.length > 0 && <div>
      <h3 className="card-section-heading">Transferir controle para</h3>
      <div className="card-transfer-targets" role="group" aria-label="Transferir controle para">
        {targets.map(player => <button type="button" className="secondary" key={player.userId} disabled={disabled} aria-pressed={targetId === String(player.userId)} onClick={() => setTargetId(String(player.userId))}>
          <span className="card-transfer-shield" style={{ background: seatColors[players.findIndex(item => item.userId === player.userId) % seatColors.length] }} aria-hidden="true" />{player.name}
        </button>)}
      </div>
      {targetId && <button type="button" className="secondary card-transfer-confirm" disabled={disabled} onClick={() => onTransfer(card.id, Number(targetId))}>Confirmar: passar para {targets.find(player => String(player.userId) === targetId)?.name}</button>}
    </div>}
    {owner && card.ownerId !== viewerId && <div>
      <label htmlFor={`owner-zone-${card.id}`}>Mover para zona de {owner.name}</label>
      <select id={`owner-zone-${card.id}`} disabled={disabled} value={destination} onChange={event => setDestination(event.target.value as OwnerDestination)}>
        <option value="graveyard">Cemitério</option>
        <option value="exile">Exílio</option>
        <option value="command">Comando</option>
        <option value="hand">Mão</option>
        <option value="library-top">Grimório — topo</option>
        <option value="library-bottom">Grimório — fundo</option>
      </select>
      <button type="button" disabled={disabled} onClick={() => onMoveToOwner(card.id, destination)}>Mover para zona do dono</button>
    </div>}
  </section>;
}
