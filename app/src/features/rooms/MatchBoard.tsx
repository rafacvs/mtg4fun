import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, Match } from './roomsApi';
import type { CardStateChange } from './CardStateControls';
import { useMatch } from './useMatch';
import { CardPreview } from './CardPreview';
import { CardActionBar } from './CardActionBar';
import { CardActionMenu } from './CardActionMenu';
import { DragDestinations } from './DragDestinations';
import { CardHoverZoom, HoverCardPreview } from './HoverCardPreview';
import { FinishMatch } from './FinishMatch';
import { MatchLog } from './MatchLog';
import { describeLogEntry } from './matchLogPresentation';
import { GameActions } from './GameActions';
import { CreateInstances } from './CreateInstances';
import { PlayerMenu } from './PlayerMenu';
import { MobileTableControls } from './MobileTableControls';
import { TableQuickActions } from './TableQuickActions';
import { PanelFeedback, PanelHeader } from './TablePanel';
import { TableIcon } from './TableIcon';
import { TableFields } from './TableFields';
import { shortcutCommand } from './libraryGesture';
import { cardImageURL } from './cardImage';
import { LibraryConsultation } from './LibraryConsultation';
import { dropCell, firstFreeCell, layoutFromCanvas } from './battlefieldLayout';
import { OwnHand } from './OwnHand';
import { ZoneColumn, type CardGesture } from './PlayerTable';
import './match.css';
import './counters.css';
import './mobile-table.css';
import './desktop-table.css';

type Drag = { card: Card; x: number; y: number; zone: string | null };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match: synced, error, busy, unconfirmed, optimisticPending, draw, move, position, roll, coin, turn, consult, reveal, revealSelection, reorder, closeConsultation, counter, retry, setTapped, untapAll, setFace, setFaceDown, revealCards, createToken, createCustomToken, copyCard, hideAllRevealed, finish, transferControl } = useMatch(roomId);
  const match = synced;
  useEffect(() => { if (match?.finished) window.location.hash = '/salas'; }, [match?.finished]);
  const [sides, setSides] = useState(20);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1000px)').matches);
  const [portrait, setPortrait] = useState(() => window.matchMedia('(max-width: 1000px) and (orientation: portrait)').matches);
  const [overview, setOverview] = useState(false);
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
  const [notice, setNotice] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const closeCardMenu = useCallback(() => setCardMenuId(null), []);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const selectionControllers = useRef(new Map<string, number>());
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const moreControl = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const knownLogEntries = useRef(0);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1000px)');
    const update = () => {
      setCompact(media.matches);
      setCommandsOpen(false); setInformationOpen(false);
      if (media.matches) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); }
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1000px) and (orientation: portrait)');
    const update = () => setPortrait(media.matches);
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
  const focusPlayer = (id: number) => {
    if (focusId === id) {
      setFocusId(null); setOverview(true); setInformationOpen(false);
      if (compact) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); }
      return;
    }
    setFocusId(id); setOverview(false); setInformationOpen(false);
    if (compact) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); }
  };
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
      else if (command === 'tap') {
        const cards = selectionIds.map(id => findCard(match, id)).filter((card): card is Card => Boolean(card && card.zone === 'battlefield' && card.controllerId === match.viewerId));
        if (cards.length) void setTapped(cards.map(card => card.id), !cards[0].tapped);
      } else if (command === 'marker') void addMarkers(selectionIds);
      else if (command === 'hand' || command === 'graveyard' || command === 'exile') void moveSelection(selectionIds, command);
      else if (command === 'random') { setActionsOpen(true); setActionsAnchor(null); }
      else if (command === 'token') setCreationOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [match, busy, unconfirmed, draw, untapAll, turn, setTapped, selectionIds, move, counter]);
  useEffect(() => {
    const visible = match?.players.flatMap(player => [...player.hand ?? [], ...player.battlefield ?? [], ...player.graveyard ?? [], ...player.exile ?? [], ...player.command ?? []]) ?? [];
    const controllers = new Map(visible.map(card => [card.id, card.controllerId]));
    const previous = selectionControllers.current;
    selectionControllers.current = controllers;
    const valid = (id: string) => controllers.has(id) && (!previous.has(id) || previous.get(id) === controllers.get(id));
    setSelectionIds(current => current.every(valid) ? current : current.filter(valid));
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
    onPreview: card => { setHoverCardId(card.id); setPreviewId(card.id); },
    onZoom: card => setZoomCardId(card?.id ?? null),
    onToggleTapped: card => {
      if (busy || unconfirmed) return;
      const ids = selectionIds.includes(card.id) ? selectionIds : [card.id];
      void setTapped(ids, !card.tapped);
    },
    onInspect: (card, additive) => { if (!drag) { setHoverCardId(card.id); if (card.controllerId !== match?.viewerId) { setPreviewId(card.id); return; } setSelectionIds(current => additive || selecting ? current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id] : current.includes(card.id) ? current : [card.id]); } },
    onOpenMenu: card => { setSelectionIds(current => current.includes(card.id) ? current : [card.id]); setCardMenuId(card.id); },
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

  async function moveSelection(ids: string[], destination: string) {
    if (!match || busy || unconfirmed) return false;
    const cards = ids.map(id => findCard(match, id)).filter((card): card is Card => Boolean(card && card.controllerId === match.viewerId));
    if (!cards.length) return false;
    const [zone, placement] = destination.split('-');
    const borrowed = cards.find(card => card.zone === 'battlefield' && card.ownerId !== match.viewerId);
    if (borrowed && zone !== 'battlefield') { setCardMenuId(borrowed.id); setNotice('Escolha explicitamente a zona do dono para mover a carta.'); return false; }
    return move(cards.map(card => card.id), zone, placement as 'top' | 'bottom' | undefined);
  }

  async function addMarkers(ids: string[]) {
    for (const id of ids) {
      const card = match && findCard(match, id);
      if (!card || card.controllerId !== match?.viewerId) continue;
      if (!await counter({ target: 'card', cardId: id, subject: 'marker', color: 'red', operation: 'increment', value: 1 })) break;
    }
  }

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
      const cell = locateBattlefieldCell(x, y, battlefield) ?? firstFreeCell(battlefield);
      if (!cell || !synced) return;
      if (card.zone !== 'battlefield') {
        const ids = selectionIds.includes(card.id) ? selectionIds : [card.id];
        const ok = await move(ids, 'battlefield', undefined, { x: cell.column, row: cell.row });
        if (ok) setSelectionIds([]);
        return;
      }
      const ids = selectionIds.includes(card.id) ? [card.id, ...selectionIds.filter(id => id !== card.id)] : [card.id];
      const ok = await position(ids, cell.column, cell.row);
      if (ok) setSelectionIds([]);
      return;
    }
    const ids = selectionIds.includes(card.id) ? selectionIds : [card.id];
    if (zone !== card.zone) await moveSelection(ids, zone === 'library' ? 'library-top' : zone);
  }

  if (!match) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando mesa…'}</p>;
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const focused = match.players.find(player => player.userId === (focusId ?? match.viewerId))!;
  const ownHidden = focused.userId !== match.viewerId;
  const preview = previewId ? findCard(match, previewId) : null;
  const lastAction = match.log.at(-1);
  const actionResult = lastAction && ['roll', 'coin', 'turn'].includes(lastAction.kind) ? describeLogEntry(lastAction) : undefined;
  const zoomCard = !previewId && !drag && zoomCardId ? findCard(match, zoomCardId) : null;
  const showingOverview = compact ? overview : focusId === null;
  const showOverview = () => {
    setFocusId(null); setOverview(true); setInformationOpen(false);
    if (compact) { setHoverPreviewOpen(false); setPlayersOpen(false); setLogOpen(false); }
  };
  const togglePlayerFocus = (id: number) => focusPlayer(id);
  const quickActions = <TableQuickActions disabled={busy || unconfirmed} canDraw={own.libraryCount > 0 && !own.consulting} actionsOpen={actionsOpen}
    onTurn={() => void turn('next')} onDraw={drawOne} onUntap={() => void untapAll()}
    onActions={anchor => { setActionsAnchor(compact ? moreControl.current ?? anchor : anchor); setActionsOpen(value => !value); setCommandsOpen(false); setLibraryOpen(false); setMenuPlayerId(null); }} />;
  const closeFloatingPanel = () => { setCommandsOpen(false); setInformationOpen(false); };

  return <section className={`match-board ${drag ? 'dragging' : ''} ${compact ? 'mobile-hand-open' : ''} ${!compact ? 'desktop-table' : 'mobile-table'}`} aria-label="Mesa da partida">
    <div className="match-content">
      <div className="table-toolbar">
        <div className="toolbar-leading"><a href="/#/salas" aria-label="Voltar ao lobby" title="Voltar ao lobby"><TableIcon name="back" /><span>Lobby</span></a><strong className="table-room-label">Sala {roomId}</strong><button className="secondary selection-mode" aria-pressed={selecting} onClick={() => setSelecting(value => !value)}>Selecionar</button><span className="observing-label">Observando: <strong>{showingOverview ? 'Todas as mesas' : focused.name}</strong></span></div>
        <div className="toolbar-trailing">
          <span className="toolbar-turn"><span className="turn-light" />Turno atual: <strong>{match.currentTurn.name}</strong></span>
          <span className="turn-order" title={match.turnOrder.map(player => player.name).join(' → ')}>Ordem: {match.turnOrder.map(player => player.name).join(' → ')}</span>
          <FinishMatch match={match} busy={busy} unconfirmed={unconfirmed} error={error} onConfirm={finish} onRetry={retry} />
        </div>
      </div>
      {match.finishVotes.length > 0 && <p className="finish-vote-notice" role="status">Encerramento solicitado: {match.finishVotes.length} de {match.finishRequired} concordância(s). Use Finalizar para acompanhar ou concordar.</p>}
      {error && <p role="alert" className="error">{error}{unconfirmed && <button disabled={busy} onClick={() => void retry()}>Tentar novamente</button>}</p>}
      {optimisticPending && <p className="pending-action" role="status">Ação pendente · aguardando confirmação</p>}
      {notice && <p role="status" className="library-notice">{notice}</p>}
      <div className="table-stage">
        <div className="table-main">
          <TableFields match={match} gesture={gesture} hoverZone={drag?.zone ?? null} focusedId={focusId} disabled={busy || unconfirmed} onPlayerMenu={openPlayer} onCounter={counter} onFocus={focusPlayer} onLibrary={openLibrary} onDraw={drawOne} onHideRevealed={() => void hideAllRevealed()} ownCommands={compact ? <section className="mobile-turn-actions" aria-label="Seus comandos"><button disabled={busy || unconfirmed || own.consulting || !own.libraryCount} onClick={drawOne}>Comprar</button><button className="secondary" disabled={busy || unconfirmed} onClick={() => void turn('next')}>Passar a vez</button></section> : undefined} />
          <section ref={dockRef} className="own-dock" aria-label={compact ? 'Sua mão' : 'Sua mão e ações'}>
            <div className="dock-toggle" aria-hidden="true"><TableIcon name="hand" /><span>Mão · {own.handCount}</span></div>
            <div id="own-dock-content" className="dock-content">
              {!compact && quickActions}
              <OwnHand scrollAxis={portrait ? 'y' : 'x'} key={`${roomId}-${match.viewerId}`} cards={own.hand} count={own.handCount} hoverZone={drag?.zone ?? null} viewerId={match.viewerId} gesture={gesture} />
            </div>
          </section>
        </div>
        {compact && <>
          {(commandsOpen || informationOpen) && <div className="floating-panel-scrim" aria-hidden="true" onClick={closeFloatingPanel} />}
          <MobileTableControls moreRef={moreControl} moreOpen={commandsOpen} canDraw={own.libraryCount > 0 && !own.consulting} disabled={busy || unconfirmed}
            onDraw={drawOne} onUntap={() => void untapAll()} onTurn={() => void turn('next')}
            onMore={() => { setCommandsOpen(value => !value); setInformationOpen(false); }} />
          {commandsOpen && <section id="mobile-commands" className="mobile-commands" aria-label="Comandos da partida">
            <PanelHeader title="Comandos" closeLabel="Fechar comandos" onClose={() => setCommandsOpen(false)} />
            <button className="secondary" onClick={() => { toggleRailPanel(informationTab); setInformationOpen(true); setCommandsOpen(false); }}>Informações</button>
            <button className="secondary" onClick={() => { setCommandsOpen(false); openLibrary(); }}>Grimório</button>
            <button className="secondary" onClick={event => { setCommandsOpen(false); openPlayer(own.userId, event.currentTarget); }}>Vida e marcadores</button>
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
                  <button className="secondary player-focus" aria-label={`Ver campo de ${player.name}`} aria-pressed={!showingOverview && player.userId === focused.userId} title={!showingOverview && player.userId === focused.userId ? "Voltar à visão geral" : "Ver campo"} onClick={() => togglePlayerFocus(player.userId)}><TableIcon name={!showingOverview && player.userId === focused.userId ? "grid" : "focus"} /><span>Campo</span></button>
                  {player.userId === activePlayerId && <span className="activity-indicator">Atividade recente</span>}
                </div>
              )}</nav>
            </div>
          </section>
          <section className={`rail-panel log-panel ${logOpen ? 'is-open' : ''}`}>
            <button className="rail-tab secondary" aria-expanded={logOpen} aria-controls="log-panel-content" onClick={() => toggleRailPanel('log')}><TableIcon name="log" /><span>Registro</span>{unreadLog && <small>Novas</small>}<TableIcon name="chevron" /></button>
            <div id="log-panel-content" className="rail-panel-content" hidden={!logOpen}>
              <MatchLog entries={match.log} visible={logOpen && (!compact || informationOpen)} onUnreadChange={setUnreadLog} onPreview={id => {
                const card = findCard(match, id);
                if (card) setHoverCardId(card.id);
              }} onInspect={id => {
                const card = findCard(match, id);
                if (card) setPreviewId(card.id);
              }} />
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
    {drag && <DragDestinations active={drag.zone} />}
    {!drag && <CardActionBar cards={selectionIds.map(id => findCard(match, id)).filter((card): card is Card => card !== null)} viewerId={match.viewerId} disabled={busy || unconfirmed}
      onTapped={(ids, tapped) => void setTapped(ids, tapped)} onReveal={ids => void revealCards(ids, true)}
      onMove={(ids, destination) => { void moveSelection(ids, destination); }}
      onMarker={ids => { void addMarkers(ids); }}
      onMore={() => setCardMenuId(selectionIds[0])} onClear={() => setSelectionIds([])} />}
    <CardActionMenu card={cardMenuId ? findCard(match, cardMenuId) : null} viewerId={match.viewerId} players={match.players} disabled={busy || unconfirmed} onClose={closeCardMenu}
      onMove={moveSelection} onMoveToOwner={(id, destination) => { const [zone, placement] = destination.split('-'); void move([id], zone, placement as 'top' | 'bottom' | undefined).then(ok => { if (ok) setNotice(''); }); }} onCounter={counter} onStateChange={changeCardState} onCopy={id => void copyCard(id)} onTransfer={(id, playerId) => void transferControl(id, playerId)} onHideAll={() => void hideAllRevealed()} onInspect={setPreviewId} />
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
    <CardPreview readingActions={portrait} players={match.players} onMove={(cardId, destination) => {
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
    const { projection, cardWidth, zoom, box } = layoutFromCanvas(cards, canvas);
    const cell = dropCell(projection.layout, (x - box.left) / zoom / cardWidth, (y - box.top) / zoom / cardWidth);
    return cell && projection.destination(cell.column, cell.row);
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
