import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { EmojiBar } from '../minigames/EmojiBar';
import { SpectatorActions } from './SpectatorActions';
import { CardPreview } from './CardPreview';
import { CardHoverZoom } from './HoverCardPreview';
import { findCard } from './matchCards';
import { MatchLog } from './MatchLog';
import { useMatchShake } from './useMatchShake';
import { useChatShortcut } from './useChatShortcut';
import type { CardGesture } from './PlayerTable';
import { PlayerMenu } from './PlayerMenu';
import { PlayingCard } from './PlayingCard';
import { PublicZoneViewer } from './PublicZoneViewer';
import type { Match } from './roomsApi';
import { TableFields } from './TableFields';
import { DeadFieldsToggle } from './TableQuickActions';
import { TableIcon } from './TableIcon';
import { PanelHeader } from './TablePanel';
import { useMatch } from './useMatch';
import './match.css';
import './counters.css';
import './mobile-table.css';
import './desktop-table.css';
import './hand-dock.css';
import './card-preview.css';
import './spectator.css';

type Player = Match['players'][number];
type OpenZone = { playerId: number; zone: 'graveyard' | 'exile'; anchor: HTMLElement };

const compactQuery = '(max-width: 1000px)';
const ignoreDrag = () => {};
const noCounters = () => Promise.resolve(false);

// Assistir só lê a partida e reage com emojis: nenhum gesto daqui chega a uma ação do jogo.
export function SpectatorBoard({ roomId }: { roomId: number }) {
  useMatchShake();
  const { match, error } = useMatch(roomId);
  const [compact, setCompact] = useState(() => window.matchMedia(compactQuery).matches);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [overview, setOverview] = useState(false);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [chatRequest, setChatRequest] = useState(0);
  useChatShortcut(Boolean(match), () => {
    if (logOpen) setLogOpen(false);
    else { setChatRequest(value => value + 1); setLogOpen(true); }
  });
  const [hideDead, setHideDead] = useState(false);
  const [menu, setMenu] = useState<{ playerId: number; anchor: HTMLElement } | null>(null);
  const [openZone, setOpenZone] = useState<OpenZone | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [zoomCardId, setZoomCardId] = useState<string | null>(null);
  const dock = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia(compactQuery);
    const update = () => { setCompact(media.matches); setFocusId(null); setOverview(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const node = dock.current;
    const board = node?.closest<HTMLElement>('.match-board');
    if (!node || !board) return;
    const update = () => board.style.setProperty('--dock-height', `${node.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [Boolean(match)]);

  if (!match) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando mesa…'}</p>;
  const seats = match.turnOrder.flatMap(turn => match.players.filter(player => player.userId === turn.userId));
  const watched = seats.find(player => player.userId === chosenId) ?? seats[0] ?? match.players[0];
  const preview = previewId ? findCard(match, previewId) : null;
  const zoomCard = !previewId && zoomCardId ? findCard(match, zoomCardId) : null;
  const zonePlayer = openZone && match.players.find(player => player.userId === openZone.playerId);
  const gesture: CardGesture = {
    onZoom: card => setZoomCardId(card?.id ?? null),
    onPreview: card => setPreviewId(card.id),
    onInspect: card => setPreviewId(card.id),
    onDragMove: ignoreDrag, onDragEnd: ignoreDrag, onDragCancel: ignoreDrag,
  };
  const deadCount = match.players.filter(player => player.userId !== watched.userId && player.life <= 0).length;
  const watch = (id: number) => { setChosenId(id); setOverview(false); };
  const toggleFocus = (id: number) => {
    if (compact) watch(id);
    else setFocusId(current => current === id ? null : id);
  };

  return <section className={`match-board spectator-board mobile-hand-open ${compact ? 'mobile-table' : 'desktop-table'}`} aria-label="Mesa da partida">
    <div className="match-content">
      {match.finishVotes.length > 0 && <p className="finish-vote-notice" role="status">Encerramento solicitado: {match.finishVotes.length} de {match.finishRequired} concordância(s).</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="table-stage">
        <div className="table-main">
          <TableFields hideDead={hideDead} fitAllRequest={0} match={match} watchedId={watched.userId} gesture={gesture} hoverZone={null} focusedId={compact ? (overview ? null : watched.userId) : focusId} focusEnabled={compact} fieldFocusEnabled={!compact} disabled onPlayerMenu={(playerId, anchor) => setMenu({ playerId, anchor })} onFocus={toggleFocus} onOpenZone={(player, zone, anchor) => setOpenZone({ playerId: player.userId, zone, anchor })} />
          <section ref={dock} className="own-dock spectator-dock" aria-label="Mãos dos jogadores">
            <div className="spectator-controls">
              <span className="spectator-badge"><TableIcon name="eye" />Assistindo</span>
              <div>
              <button type="button" className="actions-toggle secondary spectator-log-toggle" aria-label="Ações" title="Ações da sala" aria-expanded={Boolean(actionsAnchor)} onClick={event => setActionsAnchor(event.currentTarget)}><TableIcon name="more" /></button>
              {compact && <button type="button" className="secondary spectator-log-toggle" aria-pressed={overview} aria-label="Visão geral dos campos" title="Visão geral dos campos" onClick={() => setOverview(open => !open)}><TableIcon name="grid" /></button>}
              <button type="button" className="secondary spectator-log-toggle" aria-expanded={logOpen} aria-controls="match-rail" aria-label={logOpen ? 'Fechar crônica' : 'Abrir crônica'} title={logOpen ? 'Fechar crônica' : 'Abrir crônica'} onClick={() => setLogOpen(open => !open)}><TableIcon name="log" /></button>
              {deadCount > 0 && <DeadFieldsToggle className="spectator-log-toggle" count={deadCount} hidden={hideDead} onToggle={() => setHideDead(value => !value)} />}
              <EmojiBar />
              </div>
            </div>
            <div className="spectator-seats" role="tablist" aria-label="Escolher jogador">
              {seats.map(player => <button key={player.userId} type="button" role="tab" className="secondary" aria-selected={player.userId === watched.userId} aria-controls="spectator-hand" onClick={() => watch(player.userId)}>
                <span>{player.name}</span>
                <small aria-label={`${player.handCount} ${player.handCount === 1 ? 'carta' : 'cartas'} na mão`}><TableIcon name="hand" />{player.handCount}</small>
                {player.userId === match.currentTurn.userId && <i className="spectator-turn" title="Na vez" aria-label="Na vez" />}
              </button>)}
            </div>
            <div id="own-dock-content" className="dock-content">
              <SpectatorHand player={watched} gesture={gesture} />
            </div>
          </section>
        </div>
        {logOpen && <aside id="match-rail" className="side-rail spectator-rail" aria-label="Painéis da mesa">
          {compact && <PanelHeader title="Registro" closeLabel="Fechar crônica" onClose={() => setLogOpen(false)} />}
          <section className="rail-panel log-panel is-open">
            <div id="log-panel-content" className="rail-panel-content">
              <MatchLog match={match} chatRequest={chatRequest} entries={match.log} visible onUnreadChange={ignoreDrag} onPreview={ignoreDrag} onInspect={id => { if (findCard(match, id)) setPreviewId(id); }} />
            </div>
          </section>
        </aside>}
      </div>
    </div>
    {openZone && zonePlayer && <PublicZoneViewer title={openZone.zone === 'graveyard' ? 'Cemitério' : 'Exílio'} playerName={zonePlayer.name} cards={zonePlayer[openZone.zone] ?? []} anchor={openZone.anchor} viewerId={match.viewerId} disabled gesture={gesture} onInspect={card => setPreviewId(card.id)} onClose={() => setOpenZone(null)} />}
    <SpectatorActions anchor={actionsAnchor} onClose={() => setActionsAnchor(null)} />
    <PlayerMenu player={match.players.find(player => player.userId === menu?.playerId)} viewerId={match.viewerId} anchor={menu?.anchor ?? null} disabled busy={false} error="" unconfirmed={false} onRetry={noCounters} onCounter={noCounters} onClose={() => setMenu(null)} />
    <CardPreview mobileSheet={compact} card={preview} viewerId={match.viewerId} onClose={() => setPreviewId(null)} />
    {zoomCard && <CardHoverZoom card={zoomCard} />}
  </section>;
}

function SpectatorHand({ player, gesture }: { player: Player; gesture: CardGesture }) {
  const cards = player.hand ?? [];
  return <section id="spectator-hand" className="table-zone zone-hand" role="tabpanel" aria-label={`Mão de ${player.name}`}>
    <div className="zone-cards" style={{ '--hand-count': cards.length } as CSSProperties} tabIndex={0} aria-label="Cartas da mão">
      {cards.map((card, index) => <PlayingCard key={card.id} style={{ '--fan-offset': index - (cards.length - 1) / 2 } as CSSProperties} card={card} draggable={false} scrollable {...gesture} />)}
      {cards.length === 0 && <span className="zone-placeholder">Sem cartas na mão</span>}
    </div>
  </section>;
}
