import { useState } from 'react';
import type { Card } from './roomsApi';
import { useMatch } from './useMatch';
import { CardsZone, PlayerTable, zoneNames } from './PlayerTable';
import './match.css';

export function MatchBoard({ roomId }: { roomId: number }) {
  const { match, error, busy, draw, move } = useMatch(roomId);
  const [count, setCount] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  if (!match) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando mesa…'}</p>;
  const own = match.players.find(player => player.userId === match.viewerId)!;
  const selected = match.players.flatMap(player => [...(player.hand || []), ...(player.battlefield || []), ...(player.graveyard || []), ...(player.exile || []), ...(player.command || [])]).find(card => card.id === selectedId);
  const canMove = selected?.controllerId === match.viewerId;
  const focused = match.players.find(player => player.userId === (focusId ?? match.viewerId))!;
  const select = (card: Card) => setSelectedId(card.id);
  async function sendMove(to: string, placement?: 'top' | 'bottom') {
    if (selected && await move([selected.id], to, placement)) setSelectedId(null);
  }
  return <section className="match-board" aria-label="Mesa da partida">
    <div className="rotate-device" role="status"><strong>Gire o celular para jogar</strong><p>A mesa funciona na horizontal. Sua partida continua conectada.</p><a href="/#/salas">Voltar ao lobby</a></div>
    <div className="match-content">
      <div className="table-toolbar"><span>Observando: <strong>{focused.name}</strong></span>
        {focusId !== null && <button className="secondary show-all" onClick={() => setFocusId(null)}>Ver todas as mesas</button>}
        <span className="turn-order">Ordem: {match.turnOrder.map(turn => turn.name).join(' → ')}</span>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="table-stage">
        <div className={`match-players ${focusId !== null ? 'has-focus' : ''}`}>{match.players.map(player =>
          <PlayerTable key={player.userId} player={player} focused={player.userId === focused.userId} own={player.userId === match.viewerId} selected={selected?.id} onSelect={select} onFocus={() => setFocusId(player.userId)} />
        )}</div>
        <nav className="player-thumbnails" aria-label="Foco da mesa">{match.players.map(player =>
          <button key={player.userId} className="secondary" aria-pressed={player.userId === focused.userId} onClick={() => setFocusId(player.userId)}>
            <strong>{player.name}</strong><span>{player.userId === match.viewerId ? 'Sua mesa · ' : ''}Vida {player.life}</span><span>Campo {player.battlefieldCount} · Mão {player.handCount}</span>
          </button>
        )}</nav>
      </div>
      <section className="own-dock" aria-label="Sua mão e ações">
        <CardsZone zone="hand" count={own.handCount} cards={own.hand} selected={selected?.id} onSelect={select} />
        <section className="match-actions" aria-label="Ações da partida">
          <div className="draw-controls"><label>Comprar <input aria-label="Quantidade para comprar" type="number" min="1" value={count} onChange={event => setCount(Number(event.target.value))} /></label>
            <button disabled={busy || !Number.isInteger(count) || count < 1} onClick={() => void draw(count)}>Comprar cartas</button>
            <button className="secondary" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>Registro da partida</button>
          </div>
          {selected && <div className="selection-actions">
            <p role="status">Selecionada: <strong>{selected.name}</strong>{!canMove && ' · Carta do oponente'}</p>
            {canMove && <div className="move-actions" aria-label="Mover carta selecionada">
              {Object.entries(zoneNames).filter(([zone]) => zone !== selected.zone && zone !== 'library').map(([zone, label]) => <button disabled={busy} key={zone} onClick={() => void sendMove(zone)}>Mover para {label}</button>)}
              <button disabled={busy} onClick={() => void sendMove('library', 'top')}>Mover para Grimório (topo)</button>
              <button disabled={busy} onClick={() => void sendMove('library', 'bottom')}>Fundo do grimório</button>
            </div>}
            <button className="text-button" disabled={busy} onClick={() => setSelectedId(null)}>Limpar seleção</button>
          </div>}
        </section>
      </section>
      {showLog && <section className="match-log" aria-label="Registro da partida"><header><h2>Registro</h2><button className="secondary" onClick={() => setShowLog(false)}>Fechar registro</button></header>
        <ol>{match.log.map((entry, index) => <li key={index}>{describe(entry)}</li>)}</ol>
      </section>}
    </div>
  </section>;
}

function describe(entry: { actorName: string; kind: string; from?: string; to?: string; count?: number }) {
  if (entry.kind === 'draw') return `${entry.actorName} comprou ${entry.count} carta(s).`;
  if (entry.kind === 'move') return `${entry.actorName} moveu ${entry.count} carta(s) de ${zoneNames[entry.from || ''] || entry.from} para ${zoneNames[entry.to || ''] || entry.to}.`;
  return 'Partida iniciada.';
}
