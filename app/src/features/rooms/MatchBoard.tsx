import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card } from './roomsApi';
import type { CardStateChange } from './CardStateControls';
import { useMatch } from './useMatch';
import { CardPreview } from './CardPreview';
import { GameActions } from './GameActions';
import { LibraryConsultation } from './LibraryConsultation';
import { deckApi } from '../decks/deckApi';
import { OwnHand, PlayerTable, ZoneColumn, zoneNames, type CardGesture } from './PlayerTable';
import './match.css';

type Drag = { card: Card; x: number; y: number; zone: string | null };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, busy, unconfirmed, draw, move, position, roll, coin, turn, consult, reveal, revealSelection, reorder, closeConsultation, retry, cardState } = useMatch(roomId);
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Card | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const thumbnailsRef = useRef<HTMLElement>(null);
  const knownLogEntries = useRef(0);
  const closePreview = useCallback(() => setPreview(null), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  const openLibrary = () => { setLibraryOpen(true); setActionsOpen(false); setNotice(''); };
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
  const gesture: CardGesture = {
    onToggleTapped: card => { if (!busy && !unconfirmed) void cardState({kind: 'set_tapped', cardIds: [card.id], tapped: !card.tapped}); },
    onInspect: card => { if (!drag) setPreview(card); },
    onDragMove: (card, x, y) => { if (!busy && !unconfirmed) setDrag({ card, x, y, zone: dropZoneAt(x, y) }); },
    onDragEnd: (card, x, y) => { setDrag(null); void dropCard(card, x, y); },
    onDragCancel: () => setDrag(null),
  };

  const changeCardState: CardStateChange = (kind, card, value) => {
    const fields = kind === 'set_face'
      ? { kind, cardId: card.id, faceIndex: value }
      : { kind, cardIds: [card.id], [kind === 'set_tapped' ? 'tapped' : kind === 'set_face_down' ? 'faceDown' : 'revealed']: value };
    void cardState(fields);
  };

  async function dropCard(card: Card, x: number, y: number) {
    const zone = dropZoneAt(x, y);
    if (!zone || busy || unconfirmed || card.controllerId !== match?.viewerId) return;
    if (zone === 'battlefield') {
      const layout = battlefieldPositionAt(x, y);
      if (!layout) return;
      if (card.zone !== 'battlefield' && !await move([card.id], 'battlefield')) return;
      await position(card.id, layout.x, layout.row);
      return;
    }
    if (zone === 'library') await move([card.id], 'library', 'top');
    else if (zone === 'library-bottom') await move([card.id], 'library', 'bottom');
    else if (zone !== card.zone) await move([card.id], zone);
  }

  if (!match) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando mesa…'}</p>;
  const currentPreview = preview ? match.players.flatMap(player => [...(player.hand ?? []), ...(player.battlefield ?? []), ...(player.graveyard ?? []), ...(player.exile ?? []), ...(player.command ?? []), ...(player.consulted ?? []), ...(player.revealed ?? []), ...(player.exposedCards ?? [])]).find(card => card.id === preview.id) ?? null : null;
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const focused = match.players.find(player => player.userId === (focusId ?? match.viewerId))!;
  const ownHidden = focused.userId !== match.viewerId;
  const consultationActive = Boolean(own.consultationFrom || own.consulted?.length || own.revealed?.length);
  return <section className={`match-board ${drag ? 'dragging' : ''}`} aria-label="Mesa da partida">
    <div className="rotate-device" role="status"><strong>Gire o celular para jogar</strong><p>A mesa funciona na horizontal. Sua partida continua conectada.</p><a href="/#/salas">Voltar ao lobby</a></div>
    <div className="match-content">
      <div className="table-toolbar"><span>Observando: <strong>{focused.name}</strong></span>
        {focusId !== null && <button className="secondary show-all" onClick={() => setFocusId(null)}>Ver todas as mesas</button>}
        <span>Turno atual: <strong>{match.currentTurn.name}</strong></span>
        <span className="turn-order">Ordem: {match.turnOrder.map(player => player.name).join(' → ')}</span>
      </div>
      {error && <p role="alert" className="error">{error}{unconfirmed && <button disabled={busy} onClick={() => void retry()}>Tentar novamente</button>}</p>}
      {notice && <p role="status" className="library-notice">{notice}</p>}
      <div className="table-stage">
        <div className="table-main">
          <div className={`match-players ${focusId !== null ? 'has-focus' : ''}`}>{match.players.map(player =>
            <PlayerTable key={player.userId} player={player} focused={player.userId === focused.userId} own={player.userId === match.viewerId} viewerId={match.viewerId} hoverZone={drag?.zone ?? null} gesture={gesture} onFocus={() => setFocusId(player.userId)} onLibrary={player.userId === match.viewerId ? openLibrary : undefined} />
          )}</div>
          <section className="own-dock" aria-label="Sua mão e ações">
            <OwnHand cards={own.hand} count={own.handCount} hoverZone={drag?.zone ?? null} viewerId={match.viewerId} gesture={gesture} />
            <div className="dock-toggles">
              <button type="button" className="actions-toggle" aria-label="Grimório" aria-expanded={libraryOpen} onClick={openLibrary}>Grimório{consultationActive && <small className="consultation-pending" aria-hidden="true">Consulta em andamento</small>}</button>
              <button type="button" className="actions-toggle" aria-expanded={actionsOpen} onClick={() => { setActionsOpen(true); setLibraryOpen(false); }}>Ações</button>
            </div>
          </section>
        </div>
        <aside className="side-rail">
          <nav ref={thumbnailsRef} className="player-thumbnails" aria-label="Foco da mesa">{match.players.map(player =>
            <button key={player.userId} className="secondary" aria-pressed={player.userId === focused.userId} onClick={() => setFocusId(player.userId)}>
              <strong>{player.name}{player.userId === activePlayerId && <span className="activity-indicator">Atividade recente</span>}</strong><span>{player.userId === match.viewerId ? 'Sua mesa · ' : ''}Vida {player.life}</span><span>Campo {player.battlefieldCount} · Mão {player.handCount}</span>
            </button>
          )}</nav>
          <section className="match-log" aria-label="Registro da partida">
            <h2>Registro</h2>
            <ol ref={logRef}>{match.log.map((entry, index) => <li key={index}>{describe(entry)}</li>)}</ol>
          </section>
        </aside>
        {drag && ownHidden && <aside className="drag-own-column" aria-label="Suas zonas">
          <ZoneColumn player={own} viewerId={match.viewerId} droppable hoverZone={drag.zone} gesture={gesture} />
        </aside>}
      </div>
      {drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
        <img src={deckApi.imageURL(drag.card.name)} alt="" />
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
      onInspect={card => setPreview(card)}
      onDismiss={closeLibrary}
    />
    <GameActions onUntapAll={() => void cardState({kind: 'untap_all'})} open={actionsOpen} count={count} sides={sides} busy={busy} unconfirmed={unconfirmed} consultationActive={consultationActive} onCount={setCount} onSides={setSides} onDraw={() => void draw(count)} onRoll={() => void roll(sides)} onCoin={() => void coin()} onTurn={direction => void turn(direction)} onShuffle={() => void closeConsultation('top', true).then(ok => { if (ok) { setNotice('Grimório embaralhado.'); setActionsOpen(false); } })} onLibrary={openLibrary} onClose={closeActions} />
    <CardPreview card={currentPreview} onClose={closePreview} viewerId={match.viewerId} disabled={busy || unconfirmed} onStateChange={changeCardState} />
  </section>;
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
    return { x: anchorX + 86, row };
  }
  for (const element of elements) {
    const canvas = element.closest<HTMLElement>('[data-battlefield-canvas]');
    if (!canvas) continue;
    const zoom = Number(canvas.dataset.zoom || '1');
    const box = canvas.getBoundingClientRect();
    const cardWidth = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--card-width')) || 72;
    const localX = (x - box.left) / zoom;
    const localY = (y - box.top) / zoom;
    const pitch = cardWidth * 88 / 63 + 3;
    return { x: Math.max(0, Math.round(localX / cardWidth * 72)), row: Math.max(0, Math.floor(localY / pitch)) };
  }
  return null;
}

function describe(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number; result?: string }) {
  if (entry.kind === 'set_tapped') return `${entry.actorName} alterou virar/desvirar de ${entry.count} carta(s).`;
  if (entry.kind === 'untap_all') return `${entry.actorName} desvirou todas as cartas do próprio campo.`;
  if (entry.kind === 'set_face') return `${entry.actorName} escolheu uma face da carta.`;
  if (entry.kind === 'set_face_down') return `${entry.actorName} alterou face para baixo de ${entry.count} carta(s).`;
  if (entry.kind === 'reveal_cards') return entry.result ? `${entry.actorName} revelou ${entry.result}.` : `${entry.actorName} ocultou uma revelação.`;
  if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`;
  if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${zoneNames[entry.from || ''] || entry.from} para ${zoneNames[entry.to || ''] || entry.to}.`;
  if (entry.kind === 'position') return `${entry.actorName} reposicionou uma carta no campo.`;
  if (entry.kind === 'roll') return `${entry.actorName} rolou ${entry.result}.`;
  if (entry.kind === 'coin') return `${entry.actorName} jogou uma moeda: ${entry.result}.`;
  if (entry.kind === 'turn') return `${entry.actorName} ${entry.result}.`;
  if (entry.kind === 'consult') return `${entry.actorName} consultou o grimório em privado.`;
  if (entry.kind === 'reveal') return `${entry.actorName} revelou ${entry.result}.`;
  if (entry.kind === 'reorder') return `${entry.actorName} reorganizou uma consulta privada.`;
  if (entry.kind === 'close') return `${entry.actorName} fechou a consulta do grimório.`;
  if (entry.kind === 'shuffle') return `${entry.actorName} embaralhou o grimório.`;
  return 'Partida iniciada.';
}
