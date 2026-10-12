import type { Card, Match } from './roomsApi';
import { PlayingCard } from './PlayingCard';

export const zoneNames: Record<string, string> = { library: 'Grimório', hand: 'Mão', battlefield: 'Campo', graveyard: 'Cemitério', exile: 'Exílio', command: 'Comando', consulted: 'consulta', revealed: 'cartas reveladas' };

export type CardGesture = {
  onInspect: (card: Card) => void;
  onDragMove: (card: Card, x: number, y: number) => void;
  onDragEnd: (card: Card, x: number, y: number) => void;
  onDragCancel: () => void;
};

type Player = Match['players'][number];

type ZoneProps = {
  player: Player;
  viewerId: number;
  droppable: boolean;
  hoverZone: string | null;
  gesture: CardGesture;
};

function topCard(cards?: Card[]) {
  return cards?.at(-1);
}

function canDrag(card: Card, viewerId: number) {
  return card.controllerId === viewerId;
}

export function PlayerTable({ player, focused, own, viewerId, hoverZone, gesture, onFocus }: { player: Player; focused: boolean; own: boolean; viewerId: number; hoverZone: string | null; gesture: CardGesture; onFocus: () => void }) {
  return <article className={`player-table ${focused ? 'focused-table' : ''}`} aria-label={`Mesa de ${player.name}`}>
    <header className="player-heading"><h2>{player.name}{own && <small> · Você</small>}</h2><span>Vida: {player.life}</span><button className="secondary" onClick={onFocus} aria-label={`Ampliar mesa de ${player.name}`}>Ampliar</button></header>
    <div className="table-zones" aria-label={`Zonas de ${player.name}`}>
      <div className="playmat">
        <ZoneColumn player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} />
        <Battlefield player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} />
      </div>
      {!own && <div className="opponent-hand" aria-label={`Mão de ${player.name}`}>Mão: {player.handCount} carta(s) · Privada</div>}
    </div>
  </article>;
}

export function OwnHand({ cards = [], count, hoverZone, viewerId, gesture }: { cards?: Card[]; count: number; hoverZone: string | null; viewerId: number; gesture: CardGesture }) {
  return <section className={`table-zone zone-hand ${hoverZone === 'hand' ? 'drop-hover' : ''}`} aria-label="Mão" data-drop-zone="hand">
    <header><span>Mão</span><strong aria-label={`${count} cartas`}>{count}</strong></header>
    <div className="zone-cards">
      {cards.map(card => <PlayingCard key={card.id} card={card} draggable={canDrag(card, viewerId)} {...gesture} />)}
      {cards.length === 0 && <span className="zone-placeholder">Mão</span>}
    </div>
  </section>;
}

export function ZoneColumn({ player, viewerId, droppable, hoverZone, gesture }: ZoneProps) {
  return <div className="zone-column">
    <CardSlot zone="command" title="Comandante" count={player.commandCount} card={topCard(player.command)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <LibraryPile count={player.libraryCount} droppable={droppable} hoverZone={hoverZone} />
    <CardSlot zone="graveyard" title="Cemitério" count={player.graveyardCount} card={topCard(player.graveyard)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <CardSlot zone="exile" title="Exílio" count={player.exileCount} card={topCard(player.exile)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
  </div>;
}

function Battlefield({ player, viewerId, droppable, hoverZone, gesture }: ZoneProps) {
  const cards = player.battlefield ?? [];
  return <section className={`table-zone zone-battlefield ${droppable && hoverZone === 'battlefield' ? 'drop-hover' : ''}`} aria-label="Campo" data-drop-zone={droppable ? 'battlefield' : undefined}>
    <header><span>Campo</span><strong aria-label={`${player.battlefieldCount} cartas`}>{player.battlefieldCount}</strong></header>
    <div className="zone-cards">
      {cards.map(card => <PlayingCard key={card.id} card={card} draggable={canDrag(card, viewerId)} {...gesture} />)}
      {cards.length === 0 && <span className="zone-placeholder">Campo</span>}
    </div>
  </section>;
}

function LibraryPile({ count, droppable, hoverZone }: { count: number; droppable: boolean; hoverZone: string | null }) {
  return <section className={`table-zone zone-library ${droppable && hoverZone === 'library' ? 'drop-hover' : ''}`} aria-label="Grimório" data-drop-zone={droppable ? 'library' : undefined}>
    <header><span>Grimório</span><strong aria-label={`${count} cartas`}>{count}</strong></header>
    <div className="library-stack" role="img" aria-label="Pilha do grimório"><span /><span /><span /></div>
    {droppable && <button type="button" className={`library-bottom ${hoverZone === 'library-bottom' ? 'drop-hover' : ''}`} data-drop-zone="library-bottom" aria-label="Fundo do grimório">Fundo</button>}
  </section>;
}

function CardSlot({ zone, title, count, card, viewerId, droppable, hoverZone, gesture }: { zone: string; title: string; count: number; card?: Card; viewerId: number; droppable: boolean; hoverZone: string | null; gesture: CardGesture }) {
  return <section className={`card-slot zone-${zone} ${droppable && hoverZone === zone ? 'drop-hover' : ''}`} aria-label={zoneNames[zone]} data-drop-zone={droppable ? zone : undefined}>
    <span className="slot-label"><span>{title}</span><strong aria-label={`${count} cartas`}>{count}</strong></span>
    {card ? <PlayingCard card={card} draggable={canDrag(card, viewerId)} {...gesture} /> : <span className="slot-empty">{title}</span>}
  </section>;
}
