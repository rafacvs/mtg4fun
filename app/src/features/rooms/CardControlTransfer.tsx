import { useState } from 'react';
import type { Card, Match } from './roomsApi';

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
  const [targetId, setTargetId] = useState(() => targets[0] ? String(targets[0].userId) : '');
  const [destination, setDestination] = useState<OwnerDestination>('graveyard');
  if (card.zone !== 'battlefield' || card.controllerId !== viewerId) return null;
  const owner = players.find(player => player.userId === card.ownerId);
  return <section className="card-control-transfer" aria-label="Controle da carta">
    {targets.length > 0 && <div>
      <label htmlFor={`transfer-target-${card.id}`}>Transferir controle para</label>
      <select id={`transfer-target-${card.id}`} disabled={disabled} value={targetId} onChange={event => setTargetId(event.target.value)}>
        {targets.map(player => <option key={player.userId} value={player.userId}>{player.name}</option>)}
      </select>
      <button type="button" disabled={disabled || !targetId} onClick={() => onTransfer(card.id, Number(targetId))}>Transferir controle</button>
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
