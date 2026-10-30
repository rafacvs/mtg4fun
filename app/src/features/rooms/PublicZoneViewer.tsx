import type { Card } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { PlayingCard } from './PlayingCard';
import { PanelHeader, TablePanel } from './TablePanel';
import './public-zone-viewer.css';

export function PublicZoneViewer({ title, playerName, cards, anchor, viewerId, disabled, gesture, onInspect, onClose }: {
  title: string;
  playerName: string;
  cards: Card[];
  anchor: HTMLElement | null;
  viewerId: number;
  disabled: boolean;
  gesture: CardGesture;
  onInspect: (card: Card) => void;
  onClose: () => void;
}) {
  return <TablePanel open anchor={anchor} wide label={`${title} de ${playerName}`} className="public-zone-viewer" onClose={onClose}>
    <PanelHeader title={`${title} de ${playerName}`} subtitle={cards.length === 1 ? '1 carta' : `${cards.length} cartas`} closeLabel={`Fechar ${title.toLocaleLowerCase('pt-BR')}`} onClose={onClose} />
    <div className="public-zone-cards" aria-label={`Cartas no ${title.toLocaleLowerCase('pt-BR')}`}>
      {[...cards].reverse().map((card, index) => <ZoneCard key={card.id} card={card} top={index === 0} viewerId={viewerId} disabled={disabled} gesture={gesture} onInspect={onInspect} />)}
    </div>
  </TablePanel>;
}

function ZoneCard({ card, top, viewerId, disabled, gesture, onInspect }: { card: Card; top: boolean; viewerId: number; disabled: boolean; gesture: CardGesture; onInspect: (card: Card) => void }) {
  return <article className="public-zone-card">
    <PlayingCard {...gesture} card={card} draggable={!disabled && card.controllerId === viewerId} ariaLabel={`Ver imagem de ${card.name}`} onInspect={() => onInspect(card)} />
    <span><strong>{card.name}</strong>{top && <small>Topo</small>}</span>
  </article>;
}
