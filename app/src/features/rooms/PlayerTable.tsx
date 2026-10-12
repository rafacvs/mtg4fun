import { useEffect, useState, type CSSProperties } from 'react';
import type { Card, Match } from './roomsApi';
import { MarkerReadout } from './CounterValues';
import { PlayingCard } from './PlayingCard';

export const zoneNames: Record<string, string> = { library: 'Grimório', hand: 'Mão', battlefield: 'Campo', graveyard: 'Cemitério', exile: 'Exílio', command: 'Comando', consulted: 'consulta', revealed: 'cartas reveladas' };

export type CardGesture = {
  onInspect: (card: Card) => void;
  onToggleTapped?: (card: Card) => void;
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
  onLibrary?: () => void;
};

function topCard(cards?: Card[]) {
  return cards?.at(-1);
}

function canDrag(card: Card, viewerId: number) {
  return card.controllerId === viewerId;
}

export function PlayerTable({ player, focused, own, viewerId, hoverZone, gesture, onFocus, onLibrary }: { player: Player; focused: boolean; own: boolean; viewerId: number; hoverZone: string | null; gesture: CardGesture; onFocus: () => void; onLibrary?: () => void }) {
  return <article className={`player-table ${focused ? 'focused-table' : ''}`} aria-label={`Mesa de ${player.name}`}>
    <header className="player-heading"><h2>{player.name}{own && <small> · Você</small>}</h2><span>Vida: {player.life}</span><MarkerReadout markers={player.markers} /><button className="secondary" onClick={onFocus} aria-label={`Ampliar mesa de ${player.name}`}>Ampliar</button></header>
    <div className="table-zones" aria-label={`Zonas de ${player.name}`}>
      <div className="playmat">
        <ZoneColumn player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} onLibrary={onLibrary} />
        <Battlefield player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} />
      </div>
      {!own && <div className="opponent-hand" aria-label={`Mão de ${player.name}`}>Mão: {player.handCount} carta(s) · Privada</div>}
      {Boolean((player.revealed?.length ?? 0) + (player.exposedCards?.length ?? 0)) && <section className="table-revealed" aria-label={`Cartas reveladas de ${player.name}`}><span>Reveladas · Todos veem</span><div>{[...(player.revealed ?? []), ...(player.exposedCards ?? [])].map(card => <PlayingCard key={card.id} card={card} draggable={false} {...gesture} />)}</div></section>}
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

export function ZoneColumn({ player, viewerId, droppable, hoverZone, gesture, onLibrary }: ZoneProps) {
  return <div className="zone-column">
    <CardSlot zone="command" title="Comandante" count={player.commandCount} card={topCard(player.command)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <LibraryPile count={player.libraryCount} droppable={droppable} hoverZone={hoverZone} onOpen={onLibrary} />
    <CardSlot zone="graveyard" title="Cemitério" count={player.graveyardCount} card={topCard(player.graveyard)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <CardSlot zone="exile" title="Exílio" count={player.exileCount} card={topCard(player.exile)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
  </div>;
}

function Battlefield({ player, viewerId, droppable, hoverZone, gesture }: ZoneProps) {
  const cards = player.battlefield ?? [];
  const [zoom, setZoom] = useState(1);
  const maxRow = cards.reduce((max, card) => Math.max(max, card.row), 0);
  const maxX = cards.reduce((max, card) => Math.max(max, card.positionX), 0);
  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-field-owner="${player.userId}"] .battlefield-scroll`);
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom(current => Math.min(2.5, Math.max(0.5, Math.round((current + (event.deltaY < 0 ? 0.25 : -0.25)) * 100) / 100)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [player.userId]);
  return <section className={`table-zone zone-battlefield ${droppable && hoverZone === 'battlefield' ? 'drop-hover' : ''}`} aria-label="Campo" data-drop-zone={droppable ? 'battlefield' : undefined} data-field-owner={player.userId}>
    <header>
      <span>Campo</span>
      <span className="field-zoom">
        <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom(current => Math.max(0.5, Math.round((current - 0.25) * 100) / 100))}>−</button>
        <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom(current => Math.min(2.5, Math.round((current + 0.25) * 100) / 100))}>+</button>
      </span>
      <strong aria-label={`${player.battlefieldCount} cartas`}>{player.battlefieldCount}</strong>
    </header>
    <div className="battlefield-scroll">
      <div className="battlefield-zoom-space" style={{ '--mat-cols': Math.max(14, Math.ceil(maxX / 72) + 6), '--mat-rows': maxRow + 8, '--mat-zoom': zoom } as CSSProperties}>
        <div className="battlefield-canvas" data-battlefield-canvas data-zoom={zoom} style={{ '--mat-cols': Math.max(14, Math.ceil(maxX / 72) + 6), '--mat-rows': maxRow + 8, '--mat-zoom': zoom } as CSSProperties}>
          {cards.map(card => {
            const mates = cards.filter(other => other.row === card.row && other.positionX === card.positionX).sort((a, b) => a.stackOrder - b.stackOrder);
            const index = Math.max(0, mates.findIndex(other => other.id === card.id));
            return <div key={card.id} className="positioned-card" data-pos-x={card.positionX} data-row={card.row} data-stack-size={mates.length} style={{ left: `calc(${card.positionX} * var(--card-width) / 72 + ${index * 14}px)`, top: `calc(${card.row} * (var(--card-width) * 88 / 63 + 3px) + ${index * 16}px)`, zIndex: card.stackOrder }}><PlayingCard card={card} draggable={canDrag(card, viewerId)} {...gesture} /></div>;
          })}
        </div>
      </div>
    </div>
  </section>;
}

function LibraryPile({ count, droppable, hoverZone, onOpen }: { count: number; droppable: boolean; hoverZone: string | null; onOpen?: () => void }) {
  return <section className={`table-zone zone-library ${droppable && hoverZone === 'library' ? 'drop-hover' : ''}`} aria-label="Grimório" data-drop-zone={droppable ? 'library' : undefined}>
    <header><span>Grimório</span><strong aria-label={`${count} cartas`}>{count}</strong></header>
    <div className="library-stack" role={onOpen ? undefined : 'img'} aria-label={onOpen ? undefined : 'Pilha do grimório'}><span /><span /><span />{onOpen && <button className="library-open" aria-label="Abrir ações do grimório" onClick={onOpen} />}</div>
    {droppable && <button type="button" className={`library-bottom ${hoverZone === 'library-bottom' ? 'drop-hover' : ''}`} data-drop-zone="library-bottom" aria-label="Fundo do grimório">Fundo</button>}
  </section>;
}

function CardSlot({ zone, title, count, card, viewerId, droppable, hoverZone, gesture }: { zone: string; title: string; count: number; card?: Card; viewerId: number; droppable: boolean; hoverZone: string | null; gesture: CardGesture }) {
  return <section className={`card-slot zone-${zone} ${droppable && hoverZone === zone ? 'drop-hover' : ''}`} aria-label={zoneNames[zone]} data-drop-zone={droppable ? zone : undefined}>
    <span className="slot-label"><span>{title}</span><strong aria-label={`${count} cartas`}>{count}</strong></span>
    {card ? <PlayingCard card={card} draggable={canDrag(card, viewerId)} {...gesture} /> : <span className="slot-empty">{title}</span>}
  </section>;
}
