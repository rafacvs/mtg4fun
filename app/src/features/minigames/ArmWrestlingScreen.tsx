import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Duels } from './CoinDuelLayer';
import type { ArmPlayer, ArmState, CoinDuel } from './useCoinDuels';
import { useLiveStatus } from '../live/LiveRoom';
import type { ArmClock } from './armClock';
import './arm-wrestling.css';

const colors = ['#f4ead2', '#f2b21c', '#e8921a', '#d9381e'];
function distance(t: number) {
  t = Math.max(0, t);
  const cap = 215 / 3;
  return t <= cap ? 125 * t + 1.5 * t * t : 125 * cap + 1.5 * cap * cap + 340 * (t - cap);
}
function widths(state: ArmState, now: number) {
  const shrink = Math.max(.72, 1 - (now - state.started) / 210000);
  return state.mode === 'crazy' ? [Math.max(5, 7 * shrink)] : [5, 15, 13, 11].map(value => value * shrink);
}
function needleAngle(state: ArmState, player: ArmPlayer | undefined, now: number) {
  const time = player?.stopped || now;
  return player ? ((distance((time - state.started) / 1000) - distance((player.since - state.started) / 1000)) * (state.mode === 'crazy' ? 1.15 : 1)) % 360 : 0;
}
function Dial({ state, player, now, clock, disabled, onPress }: { state: ArmState; player?: ArmPlayer; now: number; clock: ArmClock; disabled: boolean; onPress: () => void }) {
  const needle = useRef<SVGLineElement>(null);
  const latest = useRef({ state, player });
  latest.current = { state, player };
  useLayoutEffect(() => {
    if (player?.stopped) needle.current?.setAttribute('transform', `rotate(${needleAngle(state, player, player.stopped)})`);
  }, [state, player]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const { state, player } = latest.current;
      const angle = needleAngle(state, player, clock.inputTime() ?? state.started);
      // Update the needle in this animation frame. Waiting for a React commit
      // would paint an older position, enough to miss the narrow white arc.
      needle.current?.setAttribute('transform', `rotate(${angle})`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock]);
  let start = player?.zone ?? 100;
  return <button type="button" className="arm-dial" aria-label="Acertar zona do relógio" disabled={disabled} onClick={onPress}>
    <svg viewBox="-120 -120 240 240" aria-hidden="true">
      <circle r="112" fill="none" stroke="#d8d8d0" strokeWidth="6" strokeDasharray="150 4 90 3 200 5" />
      <circle r="98" fill="none" stroke="#2c2c2c" strokeWidth="22" /><circle r="84" fill="none" stroke="#e2e2da" strokeWidth="3" />
      {widths(state, now).map((width, i) => {
        const a = start * Math.PI / 180; start += width; const b = start * Math.PI / 180;
        return <path key={i} d={`M ${98 * Math.cos(a)} ${98 * Math.sin(a)} A 98 98 0 0 1 ${98 * Math.cos(b)} ${98 * Math.sin(b)}`} stroke={colors[i]} strokeWidth="20" fill="none" />;
      })}
      <line ref={needle} x1="0" y1="0" x2="92" y2="0" stroke="#eee" strokeWidth="4" strokeLinecap="round" transform="rotate(0)" /><circle r="7" fill="#eee" />
    </svg>
  </button>;
}
export function ArmWrestlingScreen({ duel, userId, duels, artOf }: { duel: CoinDuel; userId: number; duels: Duels; artOf: (id: number) => string }) {
  const state = duel.arm!;
  const status = useLiveStatus();
  const [clock, setClock] = useState<{ now: number | null; inputTime: number | null }>({ now: null, inputTime: null });
  useEffect(() => {
    duels.armClock.reset();
    if (status !== 'open') return;
    const sync = () => { void duels.syncArmClock().catch(() => { /* Retry on the next sample or reconnect. */ }); };
    sync();
    const timer = setInterval(sync, 5000);
    return () => clearInterval(timer);
  }, [duel.id, status]);
  useEffect(() => {
    let frame = 0;
    const tick = () => { setClock({ now: duels.armClock.now(), inputTime: duels.armClock.inputTime() }); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [duels.armClock]);
  const now = clock.now ?? 0;
  const syncing = clock.now === null || status !== 'open';
  const goal = state.mode === 'crazy' ? 3 : 5;
  const mine = state.players[userId];
  const started = state.started > 0;
  const done = (mine?.hits.length ?? 0) >= goal;
  const blocked = syncing || !started || now < state.started || done || duels.pending || now < (mine?.lockUntil ?? 0);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|BUTTON/.test(event.target.tagName))) return;
      event.preventDefault();
      if (!syncing && !started && !state.ready[userId] && !duels.pending) void duels.armStart();
      else if (!blocked) void duels.armPress();
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [blocked, syncing, started, state.ready, userId, duels]);
  const players = [{ id: userId, name: duel.challengerId === userId ? duel.challengerName : duel.opponentName }, { id: duel.challengerId === userId ? duel.opponentId : duel.challengerId, name: duel.challengerId === userId ? duel.opponentName : duel.challengerName }];
  const score = (p?: ArmPlayer) => state.mode === 'crazy' ? p?.hits.length ?? 0 : p?.points ?? 0;
  const ownScore = score(mine), otherScore = score(state.players[players[1].id]);
  return <div className="duel-backdrop"><section role="dialog" aria-modal="true" aria-label={`Queda de braço contra ${players[1].name}`} className="arm-screen">
    <header><p>X1 · Queda de braço</p><h2>{players[0].name} × {players[1].name}</h2><small>Só vocês dois veem esta tela · o resultado vai pra mesa toda</small></header>
    <p className="arm-round" role="status">{state.mode === 'crazy' ? 'FASE MALUCO · +15% de velocidade · primeiro a 3 brancos' : 'Rodada normal · 5 tentativas por jogador'}</p>
    <div className="arm-stage">{players.map((player, i) => {
      const p = state.players[player.id];
      return <section key={player.id} aria-label={i === 0 ? 'Seu relógio' : 'Relógio do adversário'} className={i === 0 ? 'arm-me' : 'arm-foe'}>
        <img src={artOf(player.id)} alt="" className="arm-avatar" /><h3>{player.name}</h3>
        <Dial state={state} player={p} now={clock.inputTime ?? state.started} clock={duels.armClock} disabled={i !== 0 || blocked} onPress={() => void duels.armPress()} />
        <div className="arm-hits" aria-label={`${p?.hits.length ?? 0} de ${goal} tentativas`}>{Array.from({ length: goal }, (_, index) => <span key={index} style={{ color: colors[p?.hits[index] ?? -1] }}>{p && index < p.hits.length ? p.hits[index] < 0 ? <span aria-label="Tentativa perdida">×</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="#f7e8c0" d="M5 11c0-2 1-3.5 3-3.5h8c2 0 3 1.5 3 3.5v4c0 3.5-2.5 6-6 6h-2c-3.5 0-6-2.5-6-6z" /><path stroke="#402b16" fill="none" d="M9 8v4M12 8v4M15 8v4M8 14h8" /></svg> : '□'}</span>)}</div>
        <p>{score(p)} {state.mode === 'crazy' ? 'brancos' : 'pontos'} · {p?.hits.length ?? 0}/{goal} tentativas{(p?.hits.length ?? 0) >= goal ? ' · Finalizou' : ''}</p>
      </section>;
    })}</div>
    <div className="arm-bar"><b style={{ width: `${ownScore + otherScore ? 100 * ownScore / (ownScore + otherScore) : 50}%` }} /></div>
    <p className="arm-help" role="status">{syncing ? 'Sincronizando o relógio…' : !started ? 'Cinco tentativas cada. Branco: 12 · amarelo: 2 · laranja: 3 · vermelho: 6. Empate? Fase Maluco!' : now < state.started ? 'Prepare-se…' : done ? 'Você completou as tentativas. Aguardando o adversário.' : 'Clique no relógio, em ACERTAR ou aperte espaço. Clique errado ou volta sem clicar perde a tentativa.'}</p>
    {duels.error && <p role="alert" className="duel-error">{duels.error}</p>}
    <footer><button type="button" className="duel-secondary" disabled={duels.pending} onClick={() => void duels.forfeit()}>Arregar (conta como derrota)</button><button type="button" className="duel-primary" disabled={syncing || (started ? blocked : duels.pending || state.ready[userId])} onClick={() => void (started ? duels.armPress() : duels.armStart())}>{!started ? state.ready[userId] ? 'Aguardando adversário' : 'Começar' : done ? 'Aguardando adversário' : 'ACERTAR!'}</button></footer>
  </section></div>;
}
