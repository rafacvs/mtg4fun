import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, Match } from './roomsApi';
import type { CardStateChange } from './CardStateControls';
import { useMatch } from './useMatch';
import { CardPreview } from './CardPreview';
import { CardHoverZoom, HoverCardPreview } from './HoverCardPreview';
import { FinishMatch } from './FinishMatch';
import { MatchLogCards } from './MatchLogCards';
import { GameActions } from './GameActions';
import { CreateInstances } from './CreateInstances';
import { PlayerMenu } from './PlayerMenu';
import { FloatingTableControls } from './FloatingTableControls';
import { TableQuickActions } from './TableQuickActions';
import { PanelFeedback, PanelHeader } from './TablePanel';
import { TableIcon } from './TableIcon';
import { TableOverview } from './TableOverview';
import { shortcutCommand } from './libraryGesture';
import { cardImageURL } from './cardImage';
import { LibraryConsultation } from './LibraryConsultation';
import { dropCell, firstFreeCell, layoutFromCanvas } from './battlefieldLayout';
import { OwnHand } from './OwnHand';
import { PlayerTable, ZoneColumn, zoneNames, type CardGesture } from './PlayerTable';
import './match.css';
import './counters.css';
import './mobile-table.css';

type Drag = { card: Card; x: number; y: number; zone: string | null };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match: synced, error, busy, unconfirmed, draw, move, position, roll, coin, turn, consult, reveal, revealSelection, reorder, closeConsultation, counter, retry, setTapped, untapAll, setFace, setFaceDown, revealCards, createToken, createCustomToken, copyCard, hideAllRevealed, finish, transferControl } = useMatch(roomId);
  const [pendingPlacement, setPendingPlacement] = useState<{ ids: string[]; column: number; row: number } | null>(null);
  const match = synced && pendingPlacement ? withPendingPlacement(synced, pendingPlacement) : synced;
  useEffect(() => { if (match?.finished) window.location.hash = '/salas'; }, [match?.finished]);
  const [sides, setSides] = useState(20);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1000px)').matches);
  const [overview, setOverview] = useState(false);
  const [dockHidden, setDockHidden] = useState(() => window.matchMedia('(max-width: 1000px)').matches);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [informationOpen, setInformationOpen] = useState(false);
  const [informationTab, setInformationTab] = useState<'preview' | 'players' | 'log'>('preview');
  const [menuPlayerId, setMenuPlayerId] = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [libraryAnchor, setLibraryAnchor] = useState<HTMLElement | null>(null);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [unreadLog, setUnreadLog] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [hoverPreviewOpen, setHoverPreviewOpen] = useState(() => window.matchMedia('(min-width: 1001px)').matches);
  const [playersOpen, setPlayersOpen] = useState(() => window.matchMedia('(min-width: 1001px)').matches);
  const [logOpen, setLogOpen] = useState(() => window.matchMedia('(min-width: 1001px)').matches);
  const toggleRailPanel = (panel: 'preview' | 'players' | 'log') => {
    if (compact) {
      setInformationTab(panel);
      setHoverPreviewOpen(panel === 'preview');
      setPlayersOpen(panel === 'players');
      setLogOpen(panel === 'log');
      return;
    }
    if (panel === 'preview') setHoverPreviewOpen(value => !value);
    if (panel === 'players') setPlayersOpen(value => !value);
    if (panel === 'log') setLogOpen(value => !value);
  };
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [zoomCardId, setZoomCardId] = useState<string | null>(null);
  const [fieldZoom, setFieldZoom] = useState(0.5);
  const stepFieldZoom = (direction: -1 | 1) => setFieldZoom(current => Math.min(3, Math.max(0.25, Math.round((current + direction * 0.25) * 100) / 100)));
  const [notice, setNotice] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const knownLogEntries = useRef(0);
  const followingLog = useRef(true);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1000px)');
    const update = () => {
      setCompact(media.matches);
      setDockHidden(media.matches); setCommandsOpen(false); setInformationOpen(false);
      if (media.matches) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); }
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const closePreview = useCallback(() => setPreviewId(null), []);
  const closeCreation = useCallback(() => setCreationOpen(false), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  const closePlayer = useCallback(() => setMenuPlayerId(null), []);
  const openPlayer = (id: number, anchor: HTMLElement) => {
    setMenuAnchor(anchor); setMenuPlayerId(id); setLibraryOpen(false); setActionsOpen(false);
  };
  const openLibrary = () => {
    setLibraryAnchor(document.querySelector<HTMLElement>('.focused-table .library-open') ?? document.querySelector<HTMLElement>('.library-open'));
    setLibraryOpen(true); setActionsOpen(false); setMenuPlayerId(null); setNotice('');
  };
  const focusPlayer = (id: number) => { setFocusId(id); setOverview(false); setInformationOpen(false); if (compact) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); } };
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
    if (!list) return;
    if (followingLog.current) { list.scrollTop = list.scrollHeight; setUnreadLog(false); }
    else setUnreadLog(true);
  }, [match?.log.length, logOpen, informationOpen]);
  useEffect(() => {
    if (!match) return;
    const previousLength = knownLogEntries.current;
    knownLogEntries.current = match.log.length;
    if (previousLength === 0 || match.log.length <= previousLength) return;
    const actorId = match.log.at(-1)?.actorId;
    if (!actorId) return;
    setActivePlayerId(actorId);
    const timeout = window.setTimeout(() => setActivePlayerId(null), 3_000);
    return () => window.clearTimeout(timeout);
  }, [match?.log.length]);
  const drawOne = () => {
    if (!busy && !unconfirmed && !match?.players.find(player => player.userId === match.viewerId)?.consulting) void draw(1);
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
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setSelectionIds([]);
        if (window.matchMedia('(max-width: 1000px)').matches) { setInformationOpen(false); setCommandsOpen(false); }
      }
    };
    window.addEventListener('keydown', clear);
    return () => window.removeEventListener('keydown', clear);
  }, []);
  const gesture: CardGesture = {
    selectedIds: selectionIds,
    onSelectArea: cards => setSelectionIds(cards.filter(card => card.controllerId === match?.viewerId).map(card => card.id)),
    onHover: card => { if (!drag) setHoverCardId(card.id); },
    onPreview: card => { setHoverCardId(card.id); setHoverPreviewOpen(true); if (compact) { setInformationOpen(true); setInformationTab('preview'); setCommandsOpen(false); setPlayersOpen(false); setLogOpen(false); } },
    onZoom: card => setZoomCardId(card?.id ?? null),
    onToggleTapped: card => {
      if (busy || unconfirmed) return;
      const ids = selectionIds.includes(card.id) ? selectionIds : [card.id];
      void setTapped(ids, !card.tapped);
    },
    onInspect: card => { if (!drag) { setHoverCardId(card.id); setPreviewId(card.id); } },
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
      const battlefield = synced?.players.find(player => player.userId === synced.viewerId)?.battlefield ?? [];
      const cell = locateBattlefieldCell(x, y, battlefield);
      if (!cell || !synced) return;
      if (card.zone !== 'battlefield') {
        setPendingPlacement({ ids: [card.id], column: cell.column, row: cell.row });
        const ok = await move([card.id], 'battlefield', undefined, { x: cell.column, row: cell.row });
        setPendingPlacement(null);
        if (ok) setSelectionIds([]);
        return;
      }
      const ids = selectionIds.includes(card.id) ? [card.id, ...selectionIds.filter(id => id !== card.id)] : [card.id];
      setPendingPlacement({ ids, column: cell.column, row: cell.row });
      const ok = await position(ids, cell.column, cell.row);
      setPendingPlacement(null);
      if (ok) setSelectionIds([]);
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
  const preview = previewId ? findCard(match, previewId) : null;
  const lastAction = match.log.at(-1);
  const actionResult = lastAction && ['roll', 'coin', 'turn'].includes(lastAction.kind) ? describe(lastAction) : undefined;
  const zoomCard = !previewId && !drag && zoomCardId ? findCard(match, zoomCardId) : null;
  const showingOverview = compact ? overview : focusId === null;
  const showOverview = () => {
    setFocusId(null); setOverview(true); setInformationOpen(false);
    if (compact) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); }
  };
  const togglePlayerFocus = (id: number) => {
    if (!showingOverview && focused.userId === id) showOverview();
    else focusPlayer(id);
  };
  const miniatureOverview = showingOverview && (compact || match.players.length > 2);
  const quickActions = <TableQuickActions disabled={busy || unconfirmed} canDraw={own.libraryCount > 0 && !own.consulting} actionsOpen={actionsOpen}
    onTurn={() => void turn('next')} onDraw={drawOne} onUntap={() => void untapAll()}
    onActions={anchor => { setActionsAnchor(compact ? document.querySelector<HTMLElement>('.floating-table-controls button[aria-label="Comandos"]') : anchor); setActionsOpen(value => !value); setCommandsOpen(false); setLibraryOpen(false); setMenuPlayerId(null); }} />;
  const closeFloatingPanel = () => { setCommandsOpen(false); setInformationOpen(false); };

  return <section className={`match-board ${drag ? 'dragging' : ''} ${compact && !dockHidden ? 'mobile-hand-open' : ''}`} aria-label="Mesa da partida">
    <div className="match-content">
      <div className="table-toolbar">
        <div className="toolbar-leading"><a href="/#/salas" aria-label="Voltar ao lobby" title="Voltar ao lobby"><TableIcon name="back" /><span>Lobby</span></a><strong className="table-room-label">Sala {roomId}</strong><span className="observing-label">Observando: <strong>{showingOverview ? 'Todas as mesas' : focused.name}</strong></span></div>
        <div className="toolbar-zoom" role="group" aria-label="Zoom do campo">
          <button type="button" aria-label="Diminuir zoom" disabled={fieldZoom <= 0.25} onClick={() => stepFieldZoom(-1)}>−</button>
          <button type="button" aria-label="Aumentar zoom" disabled={fieldZoom >= 3} onClick={() => stepFieldZoom(1)}>+</button>
        </div>
        <div className="toolbar-trailing">
          <span className="toolbar-turn"><span className="turn-light" />Turno atual: <strong>{match.currentTurn.name}</strong></span>
          <span className="turn-order" title={match.turnOrder.map(player => player.name).join(' → ')}>Ordem: {match.turnOrder.map(player => player.name).join(' → ')}</span>
          <FinishMatch match={match} busy={busy} unconfirmed={unconfirmed} error={error} onConfirm={finish} onRetry={retry} />
        </div>
      </div>
      {match.finishVotes.length > 0 && <p className="finish-vote-notice" role="status">Encerramento solicitado: {match.finishVotes.length} de {match.finishRequired} concordância(s). Use Finalizar para acompanhar ou concordar.</p>}
      {error && <p role="alert" className="error">{error}{unconfirmed && <button disabled={busy} onClick={() => void retry()}>Tentar novamente</button>}</p>}
      {notice && <p role="status" className="library-notice">{notice}</p>}
      <div className="table-stage">
        <div className="table-main">
          {miniatureOverview ? <TableOverview match={match} onFocus={focusPlayer} /> : <div className={`match-players ${focusId !== null || compact ? 'has-focus' : ''}`}>{match.players.map(player =>
            <PlayerTable key={player.userId} player={player} focused={player.userId === focused.userId} own={player.userId === match.viewerId} viewerId={match.viewerId} hoverZone={drag?.zone ?? null} gesture={gesture} fieldZoom={fieldZoom} onFieldZoom={stepFieldZoom} expanded={!showingOverview} onFocus={() => togglePlayerFocus(player.userId)} onReturnToOwn={!showingOverview && player.userId !== match.viewerId && player.userId === focused.userId ? () => focusPlayer(match.viewerId) : undefined} onPlayerMenu={anchor => openPlayer(player.userId, anchor)} currentTurn={player.userId === match.currentTurn.userId} onLibrary={player.userId === match.viewerId ? openLibrary : undefined} onDraw={player.userId === match.viewerId ? drawOne : undefined} onHideRevealed={player.userId === match.viewerId ? () => void hideAllRevealed() : undefined} disabled={busy || unconfirmed} />
          )}</div>}
          <section ref={dockRef} hidden={compact && dockHidden} className={`own-dock ${dockHidden ? 'is-collapsed' : ''}`} aria-label={compact ? 'Sua mão' : 'Sua mão e ações'}>
            <button className="dock-toggle secondary" aria-label={compact ? 'Fechar mão' : dockHidden ? `Mostrar mão (${own.handCount}) e ações` : 'Ocultar mão e ações'} aria-expanded={!dockHidden} aria-controls="own-dock-content" onClick={() => setDockHidden(value => !value)}><TableIcon name="hand" /><span>{dockHidden ? `Mostrar mão (${own.handCount}) e ações` : `Mão · ${own.handCount}`}</span><small hidden={dockHidden || compact}>Ocultar</small><TableIcon name={compact ? "close" : "chevron"} /></button>
            <div id="own-dock-content" className="dock-content" hidden={dockHidden}>
              {!compact && quickActions}
              <OwnHand key={`${roomId}-${match.viewerId}`} cards={own.hand} count={own.handCount} hoverZone={drag?.zone ?? null} viewerId={match.viewerId} gesture={gesture} />
            </div>
          </section>
        </div>
        {compact && <>
          {(commandsOpen || informationOpen) && <div className="floating-panel-scrim" aria-hidden="true" onClick={closeFloatingPanel} />}
          <FloatingTableControls handOpen={!dockHidden} commandsOpen={commandsOpen} informationOpen={informationOpen} handCount={own.handCount} unreadLog={unreadLog}
            onHand={() => setDockHidden(value => !value)}
            onCommands={() => { setCommandsOpen(value => !value); setInformationOpen(false); }}
            onInformation={() => { if (!informationOpen) toggleRailPanel(informationTab); setInformationOpen(value => !value); setCommandsOpen(false); }} />
          {commandsOpen && <section id="mobile-commands" className="mobile-commands" aria-label="Comandos da partida">
            <PanelHeader title="Comandos" closeLabel="Fechar comandos" onClose={() => setCommandsOpen(false)} />
            {quickActions}
            <PanelFeedback error={error} busy={busy} unconfirmed={unconfirmed} onRetry={retry} />
            {actionResult && <p role="status" className="command-result">{actionResult}</p>}
          </section>}
        </>}
        <aside id="match-rail" className="side-rail" hidden={compact && !informationOpen} aria-label="Painéis da mesa">
          {compact && <PanelHeader title="Informações" closeLabel="Fechar informações" onClose={() => setInformationOpen(false)} />}
          <section className={`rail-panel preview-panel ${hoverPreviewOpen ? 'is-open' : ''}`}>
            <button className="rail-tab secondary" aria-expanded={hoverPreviewOpen} aria-controls="preview-panel-content" onClick={() => toggleRailPanel('preview')}><TableIcon name="eye" /><span>Prévia</span><TableIcon name="chevron" /></button>
            <div id="preview-panel-content" className="rail-panel-content" hidden={!hoverPreviewOpen}><HoverCardPreview card={hoverCardId ? findCard(match, hoverCardId) : null} /></div>
          </section>
          <section className={`rail-panel players-panel ${playersOpen ? 'is-open' : ''}`}>
            <button className="rail-tab secondary" aria-label="Jogadores" aria-expanded={playersOpen} aria-controls="players-panel-content" onClick={() => toggleRailPanel('players')}><TableIcon name="grid" /><span>Jogadores</span><small>{match.players.length}</small><TableIcon name="chevron" /></button>
            <div id="players-panel-content" className="rail-panel-content" hidden={!playersOpen}>
              <nav className="player-thumbnails" aria-label="Foco da mesa">{match.players.map(player =>
                <div key={player.userId} className={`player-card ${!showingOverview && player.userId === focused.userId ? 'is-observed' : ''} ${player.userId === match.currentTurn.userId ? 'is-current-turn' : ''}`}>
                  <button className="secondary player-summary" aria-label={`Abrir jogador ${player.name}`} onClick={event => openPlayer(player.userId, event.currentTarget.querySelector<HTMLElement>('[data-life-anchor]') ?? event.currentTarget)}>
                    <strong>{player.name}{player.userId === match.viewerId && <small>Você</small>}</strong><span data-life-anchor title="Vida" aria-label={`Vida ${player.life}`}><TableIcon name="heart" />{player.life}</span><span title="Cartas no campo" aria-label={`Campo ${player.battlefieldCount}`}><TableIcon name="focus" />{player.battlefieldCount}</span><span title="Cartas na mão" aria-label={`Mão ${player.handCount}`}><TableIcon name="hand" />{player.handCount}</span>
                  </button>
                  <button className="secondary player-focus" aria-label={`Ver campo de ${player.name}`} aria-pressed={!showingOverview && player.userId === focused.userId} title={!showingOverview && player.userId === focused.userId ? "Voltar à visão geral" : "Ver campo"} onClick={() => togglePlayerFocus(player.userId)}><TableIcon name={!showingOverview && player.userId === focused.userId ? "grid" : "focus"} /></button>
                  {player.userId === activePlayerId && <span className="activity-indicator">Atividade recente</span>}
                </div>
              )}</nav>
            </div>
          </section>
          <section className={`rail-panel log-panel ${logOpen ? 'is-open' : ''}`}>
            <button className="rail-tab secondary" aria-expanded={logOpen} aria-controls="log-panel-content" onClick={() => toggleRailPanel('log')}><TableIcon name="log" /><span>Registro</span>{unreadLog && <small>Novas</small>}<TableIcon name="chevron" /></button>
            <div id="log-panel-content" className="rail-panel-content" hidden={!logOpen}>
              <section className="match-log" aria-label="Registro da partida">
                <ol ref={logRef} onScroll={event => { const list = event.currentTarget; followingLog.current = list.scrollHeight - list.scrollTop - list.clientHeight < 32; if (followingLog.current) setUnreadLog(false); }}>{match.log.map((entry, index) => <li key={index}>{describe(entry)}<MatchLogCards cards={entry.cards} onPreview={id => {
                  const card = findCard(match, id);
                  if (card) gesture.onPreview?.(card);
                }} /></li>)}</ol>
                {unreadLog && <button className="new-log-entries secondary" onClick={() => { followingLog.current = true; if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; setUnreadLog(false); }}><TableIcon name="draw" />Novas ações</button>}
              </section>
            </div>
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
      anchor={libraryAnchor}
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
    <GameActions anchor={actionsAnchor} onCreate={() => { setCreationOpen(true); setActionsOpen(false); }} open={actionsOpen} sides={sides} busy={busy} unconfirmed={unconfirmed} error={error} onRetry={retry} result={actionResult} onSides={setSides} onRoll={() => void roll(sides)} onCoin={() => void coin()} onTurn={direction => void turn(direction)} onClose={closeActions} />
    <PlayerMenu player={match.players.find(player => player.userId === menuPlayerId)} viewerId={match.viewerId} anchor={menuAnchor} disabled={busy || unconfirmed} busy={busy} error={error} unconfirmed={unconfirmed} onRetry={retry} onCounter={counter} onClose={closePlayer} />
    <CreateInstances open={creationOpen} roomId={roomId} busy={busy || unconfirmed} error={error} onCreateToken={async name => {
      const cell = firstFreeCell(own.battlefield ?? []);
      const ok = await createToken(name);
      if (ok) scrollBattlefieldCell(own.userId, cell.column, cell.row);
      return ok;
    }} onCreateCustom={async token => {
      const cell = firstFreeCell(own.battlefield ?? []);
      const ok = await createCustomToken(token);
      if (ok) scrollBattlefieldCell(own.userId, cell.column, cell.row);
      return ok;
    }} onClose={closeCreation} />
    <CardPreview players={match.players} onMove={(cardId, destination) => {
      const [to, placement] = destination.split('-');
      const cell = to === 'battlefield' ? firstFreeCell(own.battlefield ?? []) : null;
      return move([cardId], to, placement as 'top' | 'bottom' | undefined).then(ok => {
        if (ok && cell) scrollBattlefieldCell(own.userId, cell.column, cell.row);
        return ok;
      });
    }} onTransfer={(cardId, controllerId) => void transferControl(cardId, controllerId)} onMoveToOwner={(cardId, destination) => {
      const [to, placement] = destination.split('-');
      const cell = to === 'battlefield' ? firstFreeCell(own.battlefield ?? []) : null;
      void move([cardId], to, placement as 'top' | 'bottom' | undefined).then(ok => {
        if (ok && cell) scrollBattlefieldCell(own.userId, cell.column, cell.row);
        if (ok) setNotice('');
      });
    }} error={error} unconfirmed={unconfirmed} onRetry={retry} onHide={id => revealCards([id], false)} card={preview} editable={Boolean(preview && canEditCounter(preview, match.viewerId))} disabled={busy || unconfirmed} viewerId={match.viewerId} busy={busy} onCopy={async id => {
      const cell = firstFreeCell(own.battlefield ?? []);
      const ok = await copyCard(id);
      if (ok) scrollBattlefieldCell(own.userId, cell.column, cell.row);
    }} onStateChange={changeCardState} onCounter={(subject, operation, value, color) => {
      if (!preview) return Promise.resolve(false);
      if (subject === 'marker' && color) return counter({ target: 'card', cardId: preview.id, subject, operation, value, color });
      if (subject === 'power' || subject === 'toughness') return counter({ target: 'card', cardId: preview.id, subject, operation, value });
      return Promise.resolve(false);
    }} onClose={closePreview} />
    {zoomCard && <CardHoverZoom card={zoomCard} />}
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

function locateBattlefieldCell(x: number, y: number, cards: Card[]) {
  for (const element of document.elementsFromPoint(x, y)) {
    const canvas = element.closest<HTMLElement>('[data-battlefield-canvas]');
    if (!canvas) continue;
    const { layout, cardWidth, zoom, box } = layoutFromCanvas(cards, canvas);
    return dropCell(layout, (x - box.left) / zoom / cardWidth, (y - box.top) / zoom / cardWidth);
  }
  return null;
}

function scrollBattlefieldCell(userId: number, column: number, row: number) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const scroll = document.querySelector<HTMLElement>(`[data-field-owner="${userId}"] .battlefield-scroll`);
    const card = scroll?.querySelector<HTMLElement>(`[data-pos-x="${column}"][data-row="${row}"]`);
    if (!scroll || !card) return;
    const view = scroll.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    if (box.left < view.left) scroll.scrollLeft -= view.left - box.left;
    else if (box.right > view.right) scroll.scrollLeft += box.right - view.right;
    if (box.top < view.top) scroll.scrollTop -= view.top - box.top;
    else if (box.bottom > view.bottom) scroll.scrollTop += box.bottom - view.bottom;
  }));
}

function withPendingPlacement(match: Match, pending: { ids: string[]; column: number; row: number }): Match {
  const anchor = findCard(match, pending.ids[0]);
  if (!anchor) return match;
  const targets = new Map<string, { column: number; row: number }>();
  for (const id of pending.ids) {
    const card = findCard(match, id);
    if (!card || card.controllerId !== match.viewerId) continue;
    if (card.zone === 'battlefield') targets.set(id, { column: card.positionX + pending.column - anchor.positionX, row: card.row + pending.row - anchor.row });
    else if (id === anchor.id) targets.set(id, { column: pending.column, row: pending.row });
  }
  if (targets.size === 0) return match;
  const zones = ['hand', 'graveyard', 'exile', 'command', 'consulted', 'revealed'] as const;
  return {
    ...match,
    players: match.players.map(player => {
      const entering: Card[] = [];
      let next = { ...player };
      for (const zone of zones) {
        const cards = player[zone];
        if (!cards) continue;
        const staying = cards.filter(card => {
          const target = targets.get(card.id);
          if (!target) return true;
          entering.push({ ...card, zone: 'battlefield', positionX: target.column, row: target.row, stackOrder: 1_000_000 + entering.length });
          return false;
        });
        next = { ...next, [zone]: staying };
        if (zone === 'hand') next.handCount = staying.length;
        if (zone === 'graveyard') next.graveyardCount = staying.length;
        if (zone === 'exile') next.exileCount = staying.length;
        if (zone === 'command') next.commandCount = staying.length;
      }
      const battlefield = (player.battlefield ?? []).map(card => {
        const target = targets.get(card.id);
        return target ? { ...card, positionX: target.column, row: target.row } : card;
      });
      next.battlefield = [...battlefield, ...entering];
      next.battlefieldCount = next.battlefield.length;
      return next;
    }),
  };
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
