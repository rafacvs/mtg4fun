import { useCallback, useState } from 'react';
import type { Card } from './roomsApi';
import { useMatch } from './useMatch';
import { CardPreview } from './CardPreview';
import { deckApi } from '../decks/deckApi';
import { OwnHand, PlayerTable, ZoneColumn, zoneNames, type CardGesture } from './PlayerTable';
import './match.css';

type Drag = { card: Card; x: number; y: number; zone: string | null };

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, busy, unconfirmed, draw, move, retry } = useMatch(roomId);
  const [count, setCount] = useState(1);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [preview, setPreview] = useState<Card | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
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
        <span className="turn-order">Ordem: {match.turnOrder.map(turn => turn.name).join(' → ')}</span>
      </div>
      {error && <p role="alert" className="error">{error}{unconfirmed && <button disabled={busy} onClick={() => void retry()}>Tentar novamente</button>}</p>}
      <div className="table-stage">
        <div className={`match-players ${focusId !== null ? 'has-focus' : ''}`}>{match.players.map(player =>
          <PlayerTable key={player.userId} player={player} focused={player.userId === focused.userId} own={player.userId === match.viewerId} viewerId={match.viewerId} hoverZone={drag?.zone ?? null} gesture={gesture} onFocus={() => setFocusId(player.userId)} />
        )}</div>
        <nav className="player-thumbnails" aria-label="Foco da mesa">{match.players.map(player =>
          <button key={player.userId} className="secondary" aria-pressed={player.userId === focused.userId} onClick={() => setFocusId(player.userId)}>
            <strong>{player.name}</strong><span>{player.userId === match.viewerId ? 'Sua mesa · ' : ''}Vida {player.life}</span><span>Campo {player.battlefieldCount} · Mão {player.handCount}</span>
          </button>
        )}</nav>
        {drag && ownHidden && <aside className="drag-own-column" aria-label="Suas zonas">
          <ZoneColumn player={own} viewerId={match.viewerId} droppable hoverZone={drag.zone} gesture={gesture} />
        </aside>}
      </div>
      <section className="own-dock" aria-label="Sua mão e ações">
        <OwnHand cards={own.hand} count={own.handCount} hoverZone={drag?.zone ?? null} viewerId={match.viewerId} gesture={gesture} />
        <section className="match-actions" aria-label="Ações da partida">
          <div className="draw-controls"><label>Comprar <input aria-label="Quantidade para comprar" type="number" min="1" value={count} onChange={event => setCount(Number(event.target.value))} /></label>
            <button disabled={busy || unconfirmed || !Number.isInteger(count) || count < 1} onClick={() => void draw(count)}>Comprar cartas</button>
            <button className="secondary" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>Registro da partida</button>
          </div>
        </section>
      </section>
      {showLog && <section className="match-log" aria-label="Registro da partida"><header><h2>Registro</h2><button className="secondary" onClick={() => setShowLog(false)}>Fechar registro</button></header>
        <ol>{match.log.map((entry, index) => <li key={index}>{describe(entry)}</li>)}</ol>
      </section>}
      {drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
        <img src={deckApi.imageURL(drag.card.name)} alt="" />
      </div>}
    </div>
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

function describe(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number }) {
  if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`;
  if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${zoneNames[entry.from || ''] || entry.from} para ${zoneNames[entry.to || ''] || entry.to}.`;
  return 'Partida iniciada.';
}
