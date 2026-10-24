import { useRef } from 'react';
import type { Card, CounterAction, Match } from './roomsApi';
import { CardStateControls, type CardStateChange } from './CardStateControls';
import { CardControlTransfer, type OwnerDestination } from './CardControlTransfer';
import { MarkerRows, PowerToughnessAdjust, type OwedPair } from './CounterControls';
import { TablePanel, PanelHeader } from './TablePanel';

const destinations = [
  ['battlefield', 'Campo'], ['hand', 'Mão'], ['graveyard', 'Cemitério'], ['exile', 'Exílio'],
  ['command', 'Comando'], ['library-top', 'Topo do grimório'], ['library-bottom', 'Fundo do grimório'],
] as const;

export function CardActionMenu({ card, viewerId, players, disabled, onClose, onMove, onMoveToOwner, onStateChange, onCounter, onCopy, onTransfer, onHideAll, onInspect }: {
  card: Card | null; viewerId: number; players: Match['players']; disabled: boolean;
  onClose: () => void; onMove: (ids: string[], destination: string) => Promise<boolean>;
  onMoveToOwner: (id: string, destination: OwnerDestination) => void;
  onStateChange: CardStateChange; onCounter: (action: CounterAction) => Promise<boolean>;
  onCopy: (id: string) => void; onTransfer: (id: string, playerId: number) => void;
  onHideAll: () => void; onInspect: (id: string) => void;
}) {
  const owed = useRef<OwedPair | null>(null);
  const owedId = useRef<string | null>(null);
  if (owedId.current !== (card?.id ?? null)) { owedId.current = card?.id ?? null; owed.current = null; }
  const controlled = card?.controllerId === viewerId;
  return <TablePanel open={Boolean(card)} label="Ações da carta" className="card-action-menu" onClose={onClose}>
    {card && <>
      <PanelHeader title={card.name || 'Carta face para baixo'} subtitle="Ações da carta" onClose={onClose} closeLabel="Fechar ações da carta" />
      <button className="secondary" onClick={() => { onClose(); onInspect(card.id); }}>Inspecionar carta</button>
      {controlled && <>
        {card.ownerId === viewerId && <section aria-label="Destinos da carta" className="card-menu-destinations">{destinations.filter(([zone]) => zone !== card.zone).map(([zone, title]) => <button key={zone} disabled={disabled} onClick={() => { void onMove([card.id], zone).then(ok => { if (ok) onClose(); }); }}>{title}</button>)}</section>}
        <CardStateControls card={card} viewerId={viewerId} disabled={disabled} onChange={onStateChange} />
        <section aria-label="Modificadores da carta">
          <h3>Modificador de poder e resistência</h3>
          <PowerToughnessAdjust power={card.power ?? 0} toughness={card.toughness ?? 0} disabled={disabled} owed={owed}
            onApply={(subject, operation, value) => onCounter({ target: 'card', cardId: card.id, subject, operation, value })} />
          <h3>Marcadores</h3>
          <MarkerRows markers={card.markers} disabled={disabled} onApply={(color, operation, value) => onCounter({ target: 'card', cardId: card.id, subject: 'marker', color, operation, value })} />
        </section>
      </>}
      <CardControlTransfer card={card} players={players} viewerId={viewerId} disabled={disabled} onTransfer={onTransfer} onMoveToOwner={onMoveToOwner} />
      {card.name && <button className="secondary" disabled={disabled} onClick={() => onCopy(card.id)}>Criar cópia independente</button>}
      <button className="secondary" disabled={disabled} onClick={onHideAll}>Ocultar todas reveladas</button>
    </>}
  </TablePanel>;
}
