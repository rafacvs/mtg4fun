import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card } from './roomsApi';
import { useMatch } from './useMatch';
import { CardPreview } from './CardPreview';
import { GameActions } from './GameActions';
import { LibraryConsultation } from './LibraryConsultation';
import { deckApi } from '../decks/deckApi';
import { OwnHand, PlayerTable, ZoneColumn, zoneNames, type CardGesture } from './PlayerTable';
import './match.css';

type Drag = { card: Card; x: number; y: number; zone: string | null };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, busy, unconfirmed, draw, move, roll, coin, turn, consult, reveal, reorder, closeConsultation, retry } = useMatch(roomId);
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [preview, setPreview] = useState<Card | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  useEffect(() => {
    const list = logRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [match?.log.length]);
  const gesture: CardGesture = {
    onInspect: card => { if (!drag) setPreview(card); },
    onDragMove: (card, x, y) => { if (!busy && !unconfirmed) setDrag({ card, x, y, zone: dropZoneAt(x, y) }); },
    onDragEnd: (card, x, y) => { setDrag(null); void dropCard(card, x, y); },
    onDragCancel: () => setDrag(null),
  };

  async function dropCard(card: Card, x: number, y: number) {
    const zone = dropZoneAt(x, y);
    if (!zone || busy || unconfirmed || card.controllerId !== match?.viewerId) return;
    if (zone === 'library') await move([card.id], 'library', 'top');
    else if (zone === 'library-bottom') await move([card.id], 'library', 'bottom');
    else if (zone !== card.zone) await move([card.id], zone);
  }

  if (!match) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando mesa…'}</p>;
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const focused = match.players.find(player => player.userId === (focusId ?? match.viewerId))!;
  const ownHidden = focused.userId !== match.viewerId;
  return <section className={`match-board ${drag ? 'dragging' : ''}`} aria-label="Mesa da partida">
    <div className="rotate-device" role="status"><strong>Gire o celular para jogar</strong><p>A mesa funciona na horizontal. Sua partida continua conectada.</p><a href="/#/salas">Voltar ao lobby</a></div>
    <div className="match-content">
      <div className="table-toolbar"><span>Observando: <strong>{focused.name}</strong></span>
        {focusId !== null && <button className="secondary show-all" onClick={() => setFocusId(null)}>Ver todas as mesas</button>}
        <span>Turno atual: <strong>{match.currentTurn.name}</strong></span>
        <span className="turn-order">Ordem: {match.turnOrder.map(player => player.name).join(' → ')}</span>
      </div>
      {error && <p role="alert" className="error">{error}{unconfirmed && <button disabled={busy} onClick={() => void retry()}>Tentar novamente</button>}</p>}
      <div className="table-stage">
        <div className="table-main">
          <div className={`match-players ${focusId !== null ? 'has-focus' : ''}`}>{match.players.map(player =>
            <PlayerTable key={player.userId} player={player} focused={player.userId === focused.userId} own={player.userId === match.viewerId} viewerId={match.viewerId} hoverZone={drag?.zone ?? null} gesture={gesture} onFocus={() => setFocusId(player.userId)} />
          )}</div>
          <section className="own-dock" aria-label="Sua mão e ações">
            <OwnHand cards={own.hand} count={own.handCount} hoverZone={drag?.zone ?? null} viewerId={match.viewerId} gesture={gesture} />
            <div className="dock-toggles">
              <button type="button" className="actions-toggle" aria-expanded={libraryOpen} onClick={() => { setLibraryOpen(true); setActionsOpen(false); }}>Grimório</button>
              <button type="button" className="actions-toggle" aria-expanded={actionsOpen} onClick={() => { setActionsOpen(true); setLibraryOpen(false); }}>Ações</button>
            </div>
          </section>
        </div>
        <aside className="side-rail">
          <nav className="player-thumbnails" aria-label="Foco da mesa">{match.players.map(player =>
            <button key={player.userId} className="secondary" aria-pressed={player.userId === focused.userId} onClick={() => setFocusId(player.userId)}>
              <strong>{player.name}</strong><span>{player.userId === match.viewerId ? 'Sua mesa · ' : ''}Vida {player.life}</span><span>Campo {player.battlefieldCount} · Mão {player.handCount}</span>
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
      busy={busy || unconfirmed}
      onConsult={(from, amount) => void consult(from, amount)}
      onReveal={amount => void reveal(amount)}
      onMove={(ids, to, placement) => void move(ids, to, placement)}
      onReorder={ids => void reorder(ids)}
      onClose={(placement, shouldShuffle) => void closeConsultation(placement, shouldShuffle)}
      onInspect={card => setPreview(card)}
      onDismiss={closeLibrary}
    />
    <GameActions open={actionsOpen} count={count} sides={sides} busy={busy} unconfirmed={unconfirmed} onCount={setCount} onSides={setSides} onDraw={() => void draw(count)} onRoll={() => void roll(sides)} onCoin={() => void coin()} onTurn={direction => void turn(direction)} onClose={closeActions} />
    <CardPreview card={preview} onClose={closePreview} />
  </section>;
}

function dropZoneAt(x: number, y: number) {
  for (const element of document.elementsFromPoint(x, y)) {
    const zone = element.closest('[data-drop-zone]')?.getAttribute('data-drop-zone');
    if (zone) return zone;
  }
  return null;
}

function describe(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number; result?: string }) {
  if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`;
  if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${zoneNames[entry.from || ''] || entry.from} para ${zoneNames[entry.to || ''] || entry.to}.`;
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
