import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Card, Match } from './roomsApi';
import { MarkerReadout } from './CounterValues';
import { fitBattlefield } from './battlefieldLayout';
import { createLibraryGesture } from './libraryGesture';
import { BattlefieldCanvas } from './BattlefieldCanvas';
import { PlayingCard } from './PlayingCard';
import { TableIcon, type TableIconName } from './TableIcon';

export const zoneNames: Record<string, string> = { library: 'Grimório', hand: 'Mão', battlefield: 'Campo', graveyard: 'Cemitério', exile: 'Exílio', command: 'Comando', consulted: 'consulta', revealed: 'cartas reveladas' };

export type CardGesture = {
  selectedIds?: string[];
  onSelectArea?: (cards: Card[]) => void;
  onHover?: (card: Card) => void;
  onPreview?: (card: Card) => void;
  onZoom?: (card: Card | null) => void;
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

function lifeAnchor(source: HTMLElement) {
  return source.querySelector<HTMLElement>('[data-life-anchor]') ?? source;
}

function topCard(cards?: Card[]) {
  return cards?.at(-1);
}

function canDrag(card: Card, viewerId: number) {
  return card.controllerId === viewerId;
}

export function PlayerTable({ player, focused, expanded, own, viewerId, hoverZone, gesture, fieldZoom, onFieldZoom, onFocus, onReturnToOwn, onPlayerMenu, currentTurn, onLibrary, onDraw, onHideRevealed, disabled }: { player: Player; focused: boolean; expanded: boolean; own: boolean; viewerId: number; hoverZone: string | null; gesture: CardGesture; fieldZoom: number; onFieldZoom: (direction: -1 | 1) => void; onFocus: () => void; onReturnToOwn?: () => void; onPlayerMenu: (anchor: HTMLElement) => void; currentTurn: boolean; onLibrary?: () => void; onDraw?: () => void; onHideRevealed?: () => void; disabled?: boolean }) {
  return <article className={`player-table ${focused ? 'focused-table' : ''} ${currentTurn ? 'is-current-turn' : ''}`} aria-label={`Mesa de ${player.name}`}>
    <header className="player-heading">
      <button className="player-identity secondary" onClick={event => onPlayerMenu(lifeAnchor(event.currentTarget))} aria-label={`Abrir jogador ${player.name}`}>
        <span className="player-name-life">
          <h2>{player.name}</h2>
          {own && <small className="player-ownership">Você</small>}
          <span className="heading-life" data-life-anchor aria-label={`Vida: ${player.life}`}><TableIcon name="heart" /><span>{player.life}</span></span>
        </span>
        <TableIcon name="chevron" />
      </button>
      <MarkerReadout markers={player.markers} />
      {currentTurn && <span className="turn-badge">Turno atual</span>}
      <div className="player-view-actions">
        {onReturnToOwn && <button className="secondary return-own-table" onClick={onReturnToOwn} aria-label="Voltar para minha mesa" title="Voltar para minha mesa"><TableIcon name="back" /><span>Minha mesa</span></button>}
        <button className="secondary icon-button" onClick={onFocus} aria-label={expanded ? 'Voltar à visão geral' : `Ampliar mesa de ${player.name}`} title={expanded ? 'Voltar à visão geral' : 'Ampliar mesa'}><TableIcon name={expanded ? 'grid' : 'focus'} /></button>
      </div>
    </header>
    <div className="table-zones" aria-label={`Zonas de ${player.name}`}>
      <div className="playmat">
        <ZoneColumn player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} onLibrary={onLibrary} onDraw={onDraw} disabled={disabled} />
        <Battlefield player={player} viewerId={viewerId} droppable={own} hoverZone={hoverZone} gesture={gesture} fieldZoom={fieldZoom} onFieldZoom={onFieldZoom} />
      </div>
      {!own && <div className="opponent-hand" aria-label={`Mão de ${player.name}`}>Mão: {player.handCount} carta(s) · Privada</div>}
      {Boolean((player.revealed?.length ?? 0) + (player.exposedCards?.length ?? 0)) && <section className="table-revealed" aria-label={`Cartas reveladas de ${player.name}`}><header><span>Reveladas · Todos veem</span>{onHideRevealed && <button className="secondary" disabled={disabled} title="Ocultar todas reveladas (H)" aria-keyshortcuts="H" onClick={onHideRevealed}>Ocultar todas reveladas</button>}</header><div>{[...(player.revealed ?? []), ...(player.exposedCards ?? [])].map(card => <PlayingCard key={card.id} card={card} draggable={false} {...gesture} />)}</div></section>}
    </div>
  </article>;
}

export function ZoneColumn({ player, viewerId, droppable, hoverZone, gesture, onLibrary, onDraw, disabled }: ZoneProps) {
  return <div className="zone-column">
    <CardSlot zone="command" title="Comandante" count={player.commandCount} card={topCard(player.command)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <LibraryPile count={player.libraryCount} droppable={droppable} hoverZone={hoverZone} onOpen={onLibrary} onDraw={onDraw} disabled={disabled} />
    <CardSlot zone="graveyard" title="Cemitério" count={player.graveyardCount} card={topCard(player.graveyard)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
    <CardSlot zone="exile" title="Exílio" count={player.exileCount} card={topCard(player.exile)} viewerId={viewerId} droppable={droppable} hoverZone={hoverZone} gesture={gesture} />
  </div>;
}

function Battlefield({ player, viewerId, droppable, hoverZone, gesture, fieldZoom, onFieldZoom }: ZoneProps & { fieldZoom: number; onFieldZoom: (direction: -1 | 1) => void }) {
  const cards = player.battlefield ?? [];
  const zoom = fieldZoom;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState({ width: 0, height: 0 });
  const layout = fitBattlefield(cards, visible.width, visible.height);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => {
      const cardWidth = Number.parseFloat(getComputedStyle(node).getPropertyValue('--card-width')) || 76;
      const width = node.clientWidth / (cardWidth * zoom);
      const height = node.clientHeight / (cardWidth * zoom);
      // Ignore the small shrink caused by a scrollbar appearing, so the grid
      // does not grow and shrink forever. A real resize still updates.
      setVisible(current => {
        if (current.width === 0) return { width, height };
        const grew = width > current.width + 0.2 || height > current.height + 0.2;
        const shrank = width < current.width - 1 || height < current.height - 1;
        return grew || shrank ? { width, height } : current;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [zoom, cards.length]);
  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-field-owner="${player.userId}"] .battlefield-scroll`);
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onFieldZoom(event.deltaY < 0 ? 1 : -1);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [player.userId, onFieldZoom]);
  return <section className={`table-zone zone-battlefield ${droppable && hoverZone === 'battlefield' ? 'drop-hover' : ''}`} aria-label="Campo" data-drop-zone={droppable ? 'battlefield' : undefined} data-field-owner={player.userId}>
    <header>
      <span>Campo</span>
      <strong aria-label={`${player.battlefieldCount} cartas`}>{player.battlefieldCount}</strong>
    </header>
    <div className="battlefield-scroll" ref={scrollRef}>
      <div className="battlefield-zoom-space" style={{ '--mat-width': layout.width, '--mat-height': layout.height, '--mat-zoom': zoom } as CSSProperties}>
        <BattlefieldCanvas cards={cards} zoom={zoom} enabled={droppable} onSelectArea={gesture.onSelectArea}>
          {cards.map(card => {
            const place = layout.cards.get(card.id);
            if (!place) return null;
            return <div key={card.id} className={`positioned-card ${card.tapped ? 'tapped-slot' : ''}`} data-pos-x={card.positionX} data-row={card.row} data-stack-size={place.size} style={{ left: `calc(${place.x} * var(--card-width))`, top: `calc(${place.y} * var(--card-width))`, zIndex: card.stackOrder }}><PlayingCard card={card} draggable={canDrag(card, viewerId)} selected={gesture.selectedIds?.includes(card.id)} {...gesture} /></div>;
          })}
        </BattlefieldCanvas>
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
    <div className="card-slot library-pile">
      <ZoneLabel title="Grimório" count={count} />
      {count > 0 ? <div className="library-stack" role={onOpen ? undefined : 'img'} aria-label={onOpen ? undefined : 'Pilha do grimório'}>{[0, 1, 2].map(layer => <span key={layer}><img src="/library-back.png" alt="" draggable={false} /></span>)}</div>
        : <span className="slot-empty" aria-hidden="true"><TableIcon name="book-open" /></span>}
      {onOpen && <button className="library-open" aria-label="Abrir ações do grimório" title="Clique: ações · Duplo clique: comprar uma carta (D)" onClick={event => gesture.current.click(event.detail)} onDoubleClick={() => {
        gesture.current.doubleClick();
        if (disabled || !count) return;
        setFeedback(true); clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(false), 450);
      }} />}
    </div>
    {droppable && <button type="button" className={`library-bottom ${hoverZone === 'library-bottom' ? 'drop-hover' : ''}`} data-drop-zone="library-bottom" aria-label="Fundo do grimório">Fundo</button>}
  </section>;
}

const emptyZoneIcons = { command: 'crown', graveyard: 'skull', exile: 'orbit' } satisfies Record<string, TableIconName>;

function ZoneLabel({ title, count }: { title: string; count: number }) {
  return <>
    <strong className="zone-count" aria-label={`${count} cartas`}>{count}</strong>
    <span className="slot-label">{title}</span>
  </>;
}

function CardSlot({ zone, title, count, card, viewerId, droppable, hoverZone, gesture }: { zone: keyof typeof emptyZoneIcons; title: string; count: number; card?: Card; viewerId: number; droppable: boolean; hoverZone: string | null; gesture: CardGesture }) {
  return <section className={`card-slot zone-${zone} ${droppable && hoverZone === zone ? 'drop-hover' : ''}`} aria-label={zoneNames[zone]} data-drop-zone={droppable ? zone : undefined}>
    <ZoneLabel title={title} count={count} />
    {card ? <PlayingCard card={card} draggable={canDrag(card, viewerId)} {...gesture} /> : <span className="slot-empty" aria-hidden="true"><TableIcon name={emptyZoneIcons[zone]} /></span>}
  </section>;
}
