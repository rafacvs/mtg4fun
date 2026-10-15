import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Card, Match } from './roomsApi';
import { MarkerReadout } from './CounterValues';
import { battlefieldLayout } from './battlefieldLayout';
import { createLibraryGesture } from './libraryGesture';
import { PlayingCard } from './PlayingCard';

export const zoneNames: Record<string, string> = { library: 'Grimório', hand: 'Mão', battlefield: 'Campo', graveyard: 'Cemitério', exile: 'Exílio', command: 'Comando', consulted: 'consulta', revealed: 'cartas reveladas' };

export type CardGesture = {
  onHover?: (card: Card) => void;
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
  onDraw?: () => void;
  onHideRevealed?: () => void;
  disabled?: boolean;
};

function topCard(cards?: Card[]) {
  return cards?.at(-1);
}

function canDrag(card: Card, viewerId: number) {
  return card.controllerId === viewerId;
}

export function PlayerTable({ player, focused, own, viewerId, hoverZone, gesture, onFocus, onLibrary, onDraw, onHideRevealed, disabled }: { player: Player; focused: boolean; own: boolean; viewerId: number; hoverZone: string | null; gesture: CardGesture; onFocus: () => void; onLibrary?: () => void; onDraw?: () => void; onHideRevealed?: () => void; disabled?: boolean }) {
  return <article className={`player-table ${focused ? 'focused-table' : ''}`} aria-label={`Mesa de ${player.name}`}>
    <header className="player-heading"><h2>{player.name}{own && <small> · Você</small>}</h2><span>Vida: {player.life}</span><MarkerReadout markers={player.markers} /><button className="secondary" onClick={onFocus} aria-label={`Ampliar mesa de ${player.name}`}>Ampliar</button></header>
    <div className="table-zones" aria-label={`Zonas de ${player.name}`}>
      <div className="playmat">
        <ZoneColumn player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} onLibrary={onLibrary} onDraw={onDraw} disabled={disabled} />
        <Battlefield player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} />
      </div>
      {!own && <div className="opponent-hand" aria-label={`Mão de ${player.name}`}>Mão: {player.handCount} carta(s) · Privada</div>}
      {Boolean((player.revealed?.length ?? 0) + (player.exposedCards?.length ?? 0)) && <section className="table-revealed" aria-label={`Cartas reveladas de ${player.name}`}><header><span>Reveladas · Todos veem</span>{onHideRevealed && <button className="secondary" disabled={disabled} title="Ocultar todas reveladas (H)" aria-keyshortcuts="H" onClick={onHideRevealed}>Ocultar todas reveladas</button>}</header><div>{[...(player.revealed ?? []), ...(player.exposedCards ?? [])].map(card => <PlayingCard key={card.id} card={card} draggable={false} {...gesture} />)}</div></section>}
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

export function ZoneColumn({ player, viewerId, droppable, hoverZone, gesture, onLibrary, onDraw, disabled }: ZoneProps) {
  return <div className="zone-column">
    <CardSlot zone="command" title="Comandante" count={player.commandCount} card={topCard(player.command)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <LibraryPile count={player.libraryCount} droppable={droppable} hoverZone={hoverZone} onOpen={onLibrary} onDraw={onDraw} disabled={disabled} />
    <CardSlot zone="graveyard" title="Cemitério" count={player.graveyardCount} card={topCard(player.graveyard)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <CardSlot zone="exile" title="Exílio" count={player.exileCount} card={topCard(player.exile)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
  </div>;
}

function Battlefield({ player, viewerId, droppable, hoverZone, gesture }: ZoneProps) {
  const cards = player.battlefield ?? [];
  const [zoom, setZoom] = useState(1);
  const maxRow = cards.reduce((max, card) => Math.max(max, card.row), 0);
  const layout = battlefieldLayout(cards);
  const maxX = Math.max(0, ...[...layout.values()].map(item => item.x));
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
            const { x, index, size } = layout.get(card.id)!;
            return <div key={card.id} className={`positioned-card ${card.tapped ? 'tapped-slot' : ''}`} data-pos-x={card.positionX} data-row={card.row} data-stack-size={size} style={{ left: `calc(${x + index * 14} * var(--card-width) / 72)`, top: `calc(${card.row} * (var(--card-width) * 88 / 63 + 42px) + ${index * 16} * var(--card-width) / 72)`, zIndex: card.stackOrder }}><PlayingCard card={card} draggable={canDrag(card, viewerId)} {...gesture} /></div>;
          })}
        </div>
      </div>
    </div>
  </section>;
}

function LibraryPile({ count, droppable, hoverZone, onOpen, onDraw, disabled }: { count: number; droppable: boolean; hoverZone: string | null; onOpen?: () => void; onDraw?: () => void; disabled?: boolean }) {
  const actions = useRef({ onOpen, onDraw, disabled, count });
  actions.current = { onOpen, onDraw, disabled, count };
  const gesture = useRef(createLibraryGesture(() => actions.current.onOpen?.(), () => {
    if (!actions.current.disabled && actions.current.count > 0) actions.current.onDraw?.();
  }));
  const [feedback, setFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { gesture.current.cancel(); clearTimeout(feedbackTimer.current); }, []);
  return <section className={`table-zone zone-library ${feedback ? 'draw-feedback' : ''} ${droppable && hoverZone === 'library' ? 'drop-hover' : ''}`} aria-label="Grimório" data-drop-zone={droppable ? 'library' : undefined}>
    <header><span>Grimório</span><strong aria-label={`${count} cartas`}>{count}</strong></header>
    <div className="library-stack" role={onOpen ? undefined : 'img'} aria-label={onOpen ? undefined : 'Pilha do grimório'}>{[0, 1, 2].map(layer => <span key={layer}><img src="/library-back.png" alt="" draggable={false} /></span>)}{onOpen && <button className="library-open" aria-label="Abrir ações do grimório" title="Clique: ações · Duplo clique: comprar uma carta (D)" onClick={event => gesture.current.click(event.detail)} onDoubleClick={() => {
      gesture.current.doubleClick();
      if (disabled || !count) return;
      setFeedback(true); clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(false), 450);
    }} />}</div>
    {droppable && <button type="button" className={`library-bottom ${hoverZone === 'library-bottom' ? 'drop-hover' : ''}`} data-drop-zone="library-bottom" aria-label="Fundo do grimório">Fundo</button>}
  </section>;
}

function CardSlot({ zone, title, count, card, viewerId, droppable, hoverZone, gesture }: { zone: string; title: string; count: number; card?: Card; viewerId: number; droppable: boolean; hoverZone: string | null; gesture: CardGesture }) {
  return <section className={`card-slot zone-${zone} ${droppable && hoverZone === zone ? 'drop-hover' : ''}`} aria-label={zoneNames[zone]} data-drop-zone={droppable ? zone : undefined}>
    <span className="slot-label"><span>{title}</span><strong aria-label={`${count} cartas`}>{count}</strong></span>
    {card ? <PlayingCard card={card} draggable={canDrag(card, viewerId)} {...gesture} /> : <span className="slot-empty" aria-hidden="true">Vazio</span>}
  </section>;
}
