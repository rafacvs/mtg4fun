import { useEffect, useRef, useState } from 'react';
import { MatchLogCards } from './MatchLogCards';
import { describeLogLine, groupLogTurns, isLogAdjustment, type LogEntry, type LogFilter } from './matchLogPresentation';
import './match-log.css';
import type { Match } from './roomsApi';
import { MatchTimers, TurnStatistics } from './MatchStatistics';

export function MatchLog({ match, entries, visible, onPreview, onInspect, onUnreadChange }: {
  match: Match;
  entries: LogEntry[];
  visible: boolean;
  onPreview: (id: string) => void;
  onInspect: (id: string) => void;
  onUnreadChange: (unread: boolean) => void;
}) {
  const [filter, setFilter] = useState<LogFilter>('game');
  const [unread, setUnread] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useEffect(() => {
    if (following.current) {
      if (scroll.current) scroll.current.scrollTop = 0;
      setUnread(false); onUnreadChange(false);
    } else { setUnread(true); onUnreadChange(true); }
  }, [entries.length, visible, onUnreadChange]);
  const turns = groupLogTurns(entries).map(turn => ({ ...turn, allLines: turn.lines, lines: turn.lines.filter(({ entry }) => filter === 'all' || isLogAdjustment(entry) === (filter === 'adjustments')) }));
  return <section className="match-log" aria-label="Registro da partida">
    <MatchTimers match={match} />
    <div className="log-filters" role="group" aria-label="Filtrar registro">
      {([['statistics', 'Terrenos / Draws'], ['game', 'Jogo'], ['adjustments', 'Ajustes'], ['all', 'Tudo']] as const).map(([value, label]) => <button key={value} className="secondary" aria-pressed={filter === value} onClick={() => { setFilter(value); }} >{label}</button>)}
    </div>
    <div className="log-turns" ref={scroll} onScroll={event => {
      following.current = event.currentTarget.scrollTop < 32;
      if (following.current) { setUnread(false); onUnreadChange(false); }
    }}>
      {turns.map((turn, index) => <details className="log-turn" key={turn.number} open={index === 0}>
        <summary aria-label={`Turno ${turn.number}`}><strong>Turno {turn.number}</strong><span>{index === 0 ? 'Atual' : 'Anterior'}{filter === 'statistics' ? ' · Compras e terrenos' : ` · ${turn.lines.length} registro(s)`}</span></summary>
        {filter === 'statistics' ? <TurnStatistics players={match.players} entries={turn.allLines.map(line => line.entry)} turn={turn.number} /> : <>
        <ol>{turn.lines.map(line => <li key={line.index}>{describeLogLine(line)}<MatchLogCards cards={line.entry.cards} onPreview={onPreview} onInspect={onInspect} /></li>)}</ol>
        {!turn.lines.length && <p className="log-empty">Nenhuma ação neste filtro.</p>}
        </>}
      </details>)}
    </div>
    {unread && <button className="new-log-entries secondary" onClick={() => {
      following.current = true;
      if (scroll.current) scroll.current.scrollTop = 0;
      setUnread(false); onUnreadChange(false);
    }}>Novas ações</button>}
  </section>;
}
