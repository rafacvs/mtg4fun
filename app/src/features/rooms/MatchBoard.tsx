import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, Match } from './roomsApi';
import type { CardStateChange } from './CardStateControls';
import { useMatch } from './useMatch';
import { CardPreview } from './CardPreview';
import { HoverCardPreview } from './HoverCardPreview';
import { FinishMatch } from './FinishMatch';
import { MatchLogCards } from './MatchLogCards';
import { GameActions } from './GameActions';
import { CreateInstances } from './CreateInstances';
import { shortcutCommand } from './libraryGesture';
import { cardImageURL } from './cardImage';
import { LibraryConsultation } from './LibraryConsultation';
import { OwnHand, PlayerTable, ZoneColumn, zoneNames, type CardGesture } from './PlayerTable';
import './match.css';
import './counters.css';

type Drag = { card: Card; x: number; y: number; zone: string | null };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, busy, unconfirmed, draw, move, position, roll, coin, turn, consult, reveal, revealSelection, reorder, closeConsultation, counter, retry, setTapped, untapAll, setFace, setFaceDown, revealCards, createToken, createCustomToken, copyCard, hideAllRevealed, finish, transferControl } = useMatch(roomId);
  useEffect(() => { if (match?.finished) window.location.hash = '/salas'; }, [match?.finished]);
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(() => window.matchMedia('(min-width: 1001px)').matches);
  const [hoverPreviewOpen, setHoverPreviewOpen] = useState(true);
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const thumbnailsRef = useRef<HTMLElement>(null);
  const knownLogEntries = useRef(0);
  const closePreview = useCallback(() => setPreviewId(null), []);
  const closeCreation = useCallback(() => setCreationOpen(false), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  const openLibrary = () => { setLibraryOpen(true); setActionsOpen(false); setNotice(''); };
  useEffect(() => {
    const dock = dockRef.current;
    const board = dock?.closest<HTMLElement>('.match-board');
    if (!dock || !board) return;
    const update = () => board.style.setProperty('--dock-height', `${dock.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [Boolean(match)]);
  useEffect(() => {
    const list = logRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [match?.log.length]);
  useEffect(() => {
    if (!match) return;
    const previousLength = knownLogEntries.current;
    knownLogEntries.current = match.log.length;
    if (previousLength === 0 || match.log.length <= previousLength) return;
    const actorId = match.log.at(-1)?.actorId;
    if (!actorId) return;
    const index = match.players.findIndex(player => player.userId === actorId);
    thumbnailsRef.current?.querySelectorAll('button')?.[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setActivePlayerId(actorId);
    const timeout = window.setTimeout(() => setActivePlayerId(null), 3_000);
    return () => window.clearTimeout(timeout);
  }, [match?.log.length]);
  const drawOne = () => {
    if (!busy && !unconfirmed) void draw(1);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const editing = Boolean(target?.closest('input, textarea, select, [contenteditable], [role="textbox"]'));
      const command = shortcutCommand(event, editing || Boolean(document.querySelector('[role="dialog"]')));
      if (!match || busy || unconfirmed || !command) return;
      event.preventDefault();
      if (command === 'draw') drawOne();
      else if (command === 'untap') void untapAll();
      else if (command === 'turn') void turn('next');
      else void hideAllRevealed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [match, busy, unconfirmed, draw, untapAll, turn, hideAllRevealed]);
  useEffect(() => {
    const valid = new Set(match?.players.find(player => player.userId === match.viewerId)?.battlefield?.filter(card => card.controllerId === match.viewerId).map(card => card.id));
    setSelectionIds(current => current.every(id => valid.has(id)) ? current : current.filter(id => valid.has(id)));
  }, [match]);
  useEffect(() => {
    const clear = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) { setSelectionIds([]); }
    };
    window.addEventListener('keydown', clear);
    return () => window.removeEventListener('keydown', clear);
  }, []);
  const gesture: CardGesture = {
    selectedIds: selectionIds,
    onSelectArea: cards => setSelectionIds(cards.filter(card => card.controllerId === match?.viewerId).map(card => card.id)),
    onHover: card => { if (!drag && railOpen && hoverPreviewOpen) setHoverCardId(card.id); },
    onToggleTapped: card => {
      if (busy || unconfirmed) return;
      const ids = selectionIds.includes(card.id) ? selectionIds : [card.id];
      void setTapped(ids, !card.tapped);
    },
    onInspect: card => { if (!drag) setPreviewId(card.id); },
    onDragMove: (card, x, y) => { if (!busy && !unconfirmed) setDrag({ card, x, y, zone: dropZoneAt(x, y) }); },
    onDragEnd: (card, x, y) => { setDrag(null); void dropCard(card, x, y); },
    onDragCancel: () => setDrag(null),
  };

  const changeCardState: CardStateChange = (kind, card, value) => {
    if (kind === 'set_face') void setFace(card.id, Number(value));
    else if (kind === 'set_tapped') void setTapped([card.id], Boolean(value));
    else if (kind === 'set_face_down') void setFaceDown([card.id], Boolean(value));
    else void revealCards([card.id], Boolean(value));
  };

  async function dropCard(card: Card, x: number, y: number) {
    const zone = dropZoneAt(x, y);
    if (!zone || busy || unconfirmed || card.controllerId !== match?.viewerId) return;
    if (card.zone === 'battlefield' && card.ownerId !== match.viewerId && zone !== 'battlefield') {
      setPreviewId(card.id);
      setNotice('Escolha explicitamente a zona do dono para mover a carta.');
      return;
    }
    if (zone === 'battlefield') {
      const layout = battlefieldPositionAt(x, y);
      if (!layout) return;
      if (card.zone !== 'battlefield' && !await move([card.id], 'battlefield')) return;
      const ids = card.zone === 'battlefield' && selectionIds.includes(card.id) ? [card.id, ...selectionIds.filter(id => id !== card.id)] : [card.id];
      if (await position(ids, layout.x, layout.row)) setSelectionIds([]);
      return;
    }
    if (zone === 'library') await move([card.id], 'library', 'top');
    else if (zone === 'library-bottom') await move([card.id], 'library', 'bottom');
    else if (zone !== card.zone) await move([card.id], zone);
  }

  if (!match) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando mesa…'}</p>;
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const focused = match.players.find(player => player.userId === (focusId ?? match.viewerId))!;
  const ownHidden = focused.userId !== match.viewerId;
  const consultationActive = Boolean(own.consultationFrom || own.consulted?.length || own.revealed?.length);
  const preview = previewId ? findCard(match, previewId) : null;
  return <section className={`match-board ${drag ? 'dragging' : ''}`} aria-label="Mesa da partida">
    <div className="rotate-device" role="status"><strong>Gire o celular para jogar</strong><p>A mesa funciona na horizontal. Sua partida continua conectada.</p><a href="/#/salas">Voltar ao lobby</a></div>
    <div className="match-content">
      <div className="table-toolbar"><a href="/#/salas" aria-label="Voltar ao lobby" title="Voltar ao lobby">← Lobby</a><strong>Sala {roomId}</strong><span>Observando: <strong>{focused.name}</strong></span>
        {focusId !== null && <button className="secondary show-all" onClick={() => setFocusId(null)}>Ver todas as mesas</button>}
        <span>Turno atual: <strong>{match.currentTurn.name}</strong></span>
        <span className="turn-order" title={match.turnOrder.map(player => player.name).join(' → ')}>Ordem: {match.turnOrder.map(player => player.name).join(' → ')}</span>
        <button className="secondary rail-toggle" aria-expanded={railOpen} aria-controls="match-rail" onClick={() => setRailOpen(value => !value)} title="Jogadores e registro">{railOpen ? 'Recolher registro' : 'Jogadores / Registro'}</button>
        <button className="secondary" aria-expanded={railOpen && hoverPreviewOpen} aria-controls="hover-card-preview" onClick={() => {
          if (railOpen && hoverPreviewOpen) setHoverPreviewOpen(false);
          else { setHoverPreviewOpen(true); setRailOpen(true); }
        }}>{railOpen && hoverPreviewOpen ? 'Ocultar prévia' : 'Mostrar prévia'}</button>
        <FinishMatch match={match} busy={busy} unconfirmed={unconfirmed} error={error} onConfirm={finish} onRetry={retry} />
      </div>
      {match.finishVotes.length > 0 && <p className="finish-vote-notice" role="status">Encerramento solicitado: {match.finishVotes.length} de {match.finishRequired} concordância(s). Use Finalizar para acompanhar ou concordar.</p>}
      {error && <p role="alert" className="error">{error}{unconfirmed && <button disabled={busy} onClick={() => void retry()}>Tentar novamente</button>}</p>}
      {notice && <p role="status" className="library-notice">{notice}</p>}
      <div className="table-stage">
        <div className="table-main">
          <div className={`match-players ${focusId !== null ? 'has-focus' : ''}`}>{match.players.map(player =>
            <PlayerTable key={player.userId} player={player} focused={player.userId === focused.userId} own={player.userId === match.viewerId} viewerId={match.viewerId} hoverZone={drag?.zone ?? null} gesture={gesture} onFocus={() => setFocusId(player.userId)} onLibrary={player.userId === match.viewerId ? openLibrary : undefined} onDraw={player.userId === match.viewerId ? drawOne : undefined} onHideRevealed={player.userId === match.viewerId ? () => void hideAllRevealed() : undefined} disabled={busy || unconfirmed} />
          )}</div>
          <section ref={dockRef} className="own-dock" aria-label="Sua mão e ações">
            <nav className="quick-actions" aria-label="Ações rápidas">
              <button disabled={busy || unconfirmed || !own.libraryCount} title="Comprar uma carta (D)" aria-keyshortcuts="D" onClick={drawOne}>↓ Comprar</button>
              <button className="secondary" disabled={busy || unconfirmed} title="Desvirar todas as permanentes (U)" aria-keyshortcuts="U" onClick={() => void untapAll()}>↺ Desvirar todas</button>
              <button type="button" className="actions-toggle" aria-expanded={actionsOpen} onClick={() => { setActionsOpen(true); setLibraryOpen(false); }}>Ações</button>
            </nav>
            <OwnHand cards={own.hand} count={own.handCount} hoverZone={drag?.zone ?? null} viewerId={match.viewerId} gesture={gesture} />
          </section>
        </div>
        <aside id="match-rail" className={`side-rail ${railOpen ? '' : 'is-collapsed'}`}>
          {hoverPreviewOpen && <HoverCardPreview card={hoverCardId ? findCard(match, hoverCardId) : null} />}
          <nav ref={thumbnailsRef} className="player-thumbnails" aria-label="Foco da mesa">{match.players.map(player =>
            <button key={player.userId} className="secondary" aria-pressed={player.userId === focused.userId} onClick={() => setFocusId(player.userId)}>
              <strong title={player.userId === match.viewerId ? `${player.name} · Sua mesa` : player.name}>{player.name}</strong><span title="Vida" aria-label={`Vida ${player.life}`}>♥ {player.life}</span><span title="Cartas no campo" aria-label={`Campo ${player.battlefieldCount}`}>C {player.battlefieldCount}</span><span title="Cartas na mão" aria-label={`Mão ${player.handCount}`}>M {player.handCount}</span>{player.userId === activePlayerId && <span className="activity-indicator">Atividade recente</span>}
            </button>
          )}</nav>
          <section className="match-log" aria-label="Registro da partida">
            <h2>Registro</h2>
            <ol ref={logRef}>{match.log.map((entry, index) => <li key={index}>{describe(entry)}<MatchLogCards cards={entry.cards} onPreview={id => {
              const card = findCard(match, id);
              if (card) gesture.onHover?.(card);
            }} /></li>)}</ol>
          </section>
        </aside>
        {drag && ownHidden && <aside className="drag-own-column" aria-label="Suas zonas">
          <ZoneColumn player={own} viewerId={match.viewerId} droppable hoverZone={drag.zone} gesture={gesture} />
        </aside>}
      </div>
      {drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
        <img src={cardImageURL(drag.card)} alt="" />
      </div>}
    </div>
    <LibraryConsultation
      open={libraryOpen}
      cards={own.consulted ?? []}
      revealed={own.revealed ?? []}
      consultationFrom={own.consultationFrom}
      libraryCount={own.libraryCount}
      busy={busy}
      error={error}
      unconfirmed={unconfirmed}
      onRetry={retry}
      onConsult={consult}
      onReveal={reveal}
      onRevealSelection={revealSelection}
      onDraw={draw}
      onMove={move}
      onReorder={reorder}
      onClose={closeConsultation}
      onInspect={card => setPreviewId(card.id)}
      onDismiss={closeLibrary}
    />
    <GameActions onCreate={() => { setCreationOpen(true); setActionsOpen(false); }} open={actionsOpen} count={count} sides={sides} busy={busy} unconfirmed={unconfirmed} consultationActive={consultationActive} life={own.life} markers={own.markers} playerId={own.userId} onCount={setCount} onSides={setSides} onDraw={() => void draw(count)} onRoll={() => void roll(sides)} onCoin={() => void coin()} onTurn={direction => void turn(direction)} onShuffle={() => void closeConsultation('top', true).then(ok => { if (ok) { setNotice('Grimório embaralhado.'); setActionsOpen(false); } })} onLibrary={openLibrary} onCounter={counter} onClose={closeActions} />
    <CreateInstances open={creationOpen} roomId={roomId} busy={busy || unconfirmed} error={error} onCreateToken={createToken} onCreateCustom={createCustomToken} onClose={closeCreation} />
    <CardPreview players={match.players} onTransfer={(cardId, controllerId) => void transferControl(cardId, controllerId)} onMoveToOwner={(cardId, destination) => {
      const [to, placement] = destination.split('-');
      void move([cardId], to, placement as 'top' | 'bottom' | undefined).then(ok => { if (ok) setNotice(''); });
    }} error={error} unconfirmed={unconfirmed} onRetry={retry} onHide={id => revealCards([id], false)} card={preview} editable={Boolean(preview && canEditCounter(preview, match.viewerId))} disabled={busy || unconfirmed} viewerId={match.viewerId} busy={busy} onCopy={id => void copyCard(id)} onStateChange={changeCardState} onCounter={(subject, operation, value, color) => {
      if (!preview) return Promise.resolve(false);
      if (subject === 'marker' && color) return counter({ target: 'card', cardId: preview.id, subject, operation, value, color });
      if (subject === 'power' || subject === 'toughness') return counter({ target: 'card', cardId: preview.id, subject, operation, value });
      return Promise.resolve(false);
    }} onClose={closePreview} />
  </section>;
}

function findCard(match: Match, id: string) {
  for (const player of match.players) {
    for (const card of [...player.hand ?? [], ...player.battlefield ?? [], ...player.graveyard ?? [], ...player.exile ?? [], ...player.command ?? [], ...player.consulted ?? [], ...player.revealed ?? [], ...player.exposedCards ?? []]) {
      if (card.id === id) return card;
    }
  }
  return null;
}

function canEditCounter(card: Card, viewerId: number) {
  return (card.zone === 'battlefield' ? card.controllerId : card.ownerId) === viewerId;
}

function dropZoneAt(x: number, y: number) {
  for (const element of document.elementsFromPoint(x, y)) {
    const zone = element.closest('[data-drop-zone]')?.getAttribute('data-drop-zone');
    if (zone) return zone;
  }
  return null;
}

function battlefieldPositionAt(x: number, y: number) {
  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    const stack = element.closest<HTMLElement>('[data-stack-size]');
    if (!stack) continue;
    const size = Number(stack.dataset.stackSize);
    const anchorX = Number(stack.dataset.posX);
    const row = Number(stack.dataset.row);
    if (size < 3) return { x: anchorX, row };
    return { x: anchorX + 160, row };
  }
  for (const element of elements) {
    const canvas = element.closest<HTMLElement>('[data-battlefield-canvas]');
    if (!canvas) continue;
    const zoom = Number(canvas.dataset.zoom || '1');
    const box = canvas.getBoundingClientRect();
    const cardWidth = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--card-width')) || 72;
    const localX = (x - box.left) / zoom;
    const localY = (y - box.top) / zoom;
    const pitch = cardWidth * 88 / 63 + 42;
    return { x: Math.max(0, Math.round(localX / cardWidth * 72)), row: Math.max(0, Math.floor(localY / pitch)) };
  }
  return null;
}

function describe(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number; result?: string }) {
  if (entry.kind === 'finish_vote') return `${entry.actorName} concordou em finalizar a partida (${entry.result}).`;
  if (entry.kind === 'finished') return `${entry.actorName} confirmou o encerramento da partida (${entry.result}). Sala encerrada.`;
  if (entry.kind === 'create-token' || entry.kind === 'create-custom-token') return `${entry.actorName} criou a ficha ${entry.result}.`;
  if (entry.kind === 'copy-card') return `${entry.actorName} criou uma cópia de ${entry.result}.`;
  if (entry.kind === 'set_tapped') return `${entry.actorName} alterou virar/desvirar de ${entry.count} carta(s).`;
  if (entry.kind === 'untap_all') return `${entry.actorName} desvirou todas as cartas do próprio campo.`;
  if (entry.kind === 'set_face') return `${entry.actorName} escolheu uma face da carta.`;
  if (entry.kind === 'set_face_down') return `${entry.actorName} alterou face para baixo de ${entry.count} carta(s).`;
  if (entry.kind === 'reveal_cards') return entry.result ? `${entry.actorName} revelou ${entry.result}.` : `${entry.actorName} ocultou uma revelação.`;
  if (entry.kind === 'hide_all_revealed') return `${entry.actorName} ocultou todas as suas reveladas (${entry.count}).`;
  if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`;
  if (entry.kind === 'move' && entry.result) return `${entry.actorName}: ${entry.result} ao mover para ${zoneNames[entry.to || ''] || entry.to}.`;
  if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${zoneNames[entry.from || ''] || entry.from} para ${zoneNames[entry.to || ''] || entry.to}.`;
  if (entry.kind === 'transfer_control') return `${entry.actorName} transferiu o controle de uma carta para ${entry.result}.`;
  if (entry.kind === 'position') return `${entry.actorName} reposicionou ${entry.count || 1} carta(s) no campo.`;
  if (entry.kind === 'roll') return `${entry.actorName} rolou ${entry.result}.`;
  if (entry.kind === 'counter') return `${entry.actorName} alterou contadores: ${entry.result}.`;
  if (entry.kind === 'coin') return `${entry.actorName} jogou uma moeda: ${entry.result}.`;
  if (entry.kind === 'turn') return `${entry.actorName} ${entry.result}.`;
  if (entry.kind === 'consult') return `${entry.actorName} consultou o grimório em privado.`;
  if (entry.kind === 'reveal') return `${entry.actorName} revelou ${entry.result}.`;
  if (entry.kind === 'reorder') return `${entry.actorName} reorganizou uma consulta privada.`;
  if (entry.kind === 'close') return `${entry.actorName} fechou a consulta do grimório.`;
  if (entry.kind === 'shuffle') return `${entry.actorName} embaralhou o grimório.`;
  return 'Partida iniciada.';
}
