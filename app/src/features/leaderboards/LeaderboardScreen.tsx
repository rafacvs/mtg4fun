import { useState, type CSSProperties } from 'react';
import { playerMark } from '../rooms/playerIdentity';
import type { RankedPlayer } from './leaderboardApi';
import { useLeaderboard } from './useLeaderboard';
import './leaderboards.css';

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : minutes > 0 ? `${minutes}min ${Math.floor(seconds % 60)}s` : `${Math.floor(seconds)}s`;
}
const colors = ['#34d3b0', '#f472b6', '#6cb4ff', '#a78bfa', '#e3b75e', '#e5736a'];
const color = (id: number): CSSProperties => ({ '--player-color': colors[(id - 1) % colors.length] } as CSSProperties);
const title = (p: RankedPlayer) => p.wins ? p.winLife <= 5 ? 'Especialista em último suspiro' : 'Já está insuportável' : p.played ? 'Veio pela resenha' : 'Lenda da ausência';

type TrophyProps = { emoji: string; title: string; player?: RankedPlayer; text: (player: RankedPlayer) => string };
function Trophy({ emoji, title: label, player, text }: TrophyProps) {
  return <article className="leaderboard-award" style={player ? color(player.id) : undefined}>
    <span className="leaderboard-emoji" aria-hidden="true">{emoji}</span><div><h3>{label}</h3>
      <strong className="leaderboard-who">{player?.name ?? 'Trono vago'}</strong>
      <p>{player ? text(player) : 'O próximo vexame pode ser seu. Jogue para disputar.'}</p>
    </div>
  </article>;
}

export function LeaderboardScreen() {
  const model = useLeaderboard();
  const [shareNotice, setShareNotice] = useState('');
  const players = model.data?.players.filter(p => p.played > 0) ?? [];
  const champions = players.filter(p => p.wins > 0).slice(0, 3);
  const podium = champions.length === 3 ? [champions[1], champions[0], champions[2]] : champions;
  const best = (metric: keyof RankedPlayer) => players.filter(p => typeof p[metric] === 'number' && Number(p[metric]) > 0).sort((a, b) => Number(b[metric]) - Number(a[metric]) || a.id - b.id)[0];
  async function provoke() {
    const damage = best('damage');
    const message = `${damage ? `${damage.name} já perdeu ${number(damage.damage)} de vida. ` : ''}agiotagem segue Top 1 mais omisso. O único deck que ele pilota é o de desculpas. ${window.location.origin}/#/leaderboards`;
    try {
      await navigator.clipboard.writeText(message);
      setShareNotice('Provocação copiada. Agora é com o grupo.');
    } catch { setShareNotice(message); }
  }
  return <div className="leaderboard-screen">
    <header className="leaderboard-hero"><div><h1>Leaderboard</h1><p><span className="leaderboard-dot" />Vence quem sobra na mesa com HP acima de zero. O resto vira piada.</p></div><button type="button" onClick={() => void provoke()}>Provocar o grupo</button></header>
    {shareNotice && <p className="leaderboard-share" role="status">{shareNotice}</p>}
    <div className="leaderboard-periods" role="group" aria-label="Período do leaderboard">{([['all', 'Desde sempre'], ['month', 'Este mês'], ['week', 'Esta semana']] as const).map(([period, label]) => <button type="button" key={period} aria-pressed={model.period === period} onClick={() => model.setPeriod(period)}>{label}</button>)}</div>
    {model.error ? <div role="alert" className="error">{model.error} <button type="button" className="text-button" onClick={model.reload}>Tentar novamente</button></div> : !model.data ? <p role="status" className="loading-state">Consultando os crimes contra a paciência…</p> : <>
      <section className="leaderboard-podium" aria-label="Pódio por vitórias">
        {podium.length ? podium.map(p => { const rank = champions.indexOf(p) + 1; return <article key={p.id} style={color(p.id)} className={`leaderboard-podium-card ${rank === 1 ? 'is-first' : ''}`}>
          {rank === 1 && <span className="leaderboard-crown" aria-label="Primeiro lugar">👑</span>}
          <span className="leaderboard-avatar" aria-hidden="true">{playerMark(p.name)}</span><h2>{p.name}</h2><p>{title(p)}</p><strong className="leaderboard-score">{number(p.wins)}</strong><span className="leaderboard-muted">vitórias · {rank}º lugar</span>
        </article>; }) : <div className="leaderboard-empty"><span aria-hidden="true">👑</span><h2>A coroa está sem dono</h2><p>Ainda não há vitória confirmada neste período. Muito papo, pouca glória.</p></div>}
      </section>
      <h2 className="leaderboard-section-title">Classificação <small>por vitórias</small></h2>
      {players.length ? <div className="leaderboard-table-wrap"><table className="leaderboard-table"><caption className="leaderboard-sr-only">Classificação dos jogadores por vitórias</caption><thead><tr><th scope="col">#</th><th scope="col">Jogador</th><th scope="col">Vitórias</th><th scope="col">Aproveitamento</th><th scope="col">Sequência</th><th scope="col">HP médio ao vencer</th></tr></thead><tbody>{players.map((p, index) => <tr key={p.id} style={color(p.id)}><td className="leaderboard-rank">{index + 1}</td><th scope="row"><span className="leaderboard-player"><span className="leaderboard-avatar" aria-hidden="true">{playerMark(p.name)}</span><span>{p.name}<small>{title(p)}</small></span></span></th><td><b>{p.wins}</b><span className="leaderboard-muted"> de {p.decided}</span><span className="leaderboard-bar"><i style={{ width: `${p.decided ? p.wins / p.decided * 100 : 0}%` }} /></span></td><td>{p.decided ? `${Math.round(p.wins / p.decided * 100)}%` : '—'}</td><td className={p.streak > 0 ? 'leaderboard-hot' : 'leaderboard-cold'}>{p.streak > 0 ? `🔥 ${p.streak} vitórias` : p.streak < 0 ? `🧊 ${-p.streak} derrotas` : '—'}</td><td>{p.wins ? `${number(p.winLife)} HP` : '—'}</td></tr>)}</tbody></table></div> : <p className="leaderboard-empty">Nenhuma partida iniciada no período. A mesa está mais vazia que a agenda do agiotagem.</p>}
      <p className="leaderboard-method">{model.data.matches} partidas iniciadas no período · Aproveitamento considera apenas partidas encerradas com um único jogador acima de zero.</p>
      <h2 className="leaderboard-section-title">Troféus da zoeira <small>6 em disputa</small></h2>
      <div className="leaderboard-awards">
        <Trophy emoji="🥊" title="Saco de pancadas" player={best('damage')} text={p => `Perdeu ${number(p.damage)} de vida. A mesa agradece o cardápio.`} />
        <Trophy emoji="🧠" title="Pensador da mesa" player={best('turnSeconds')} text={p => `${duration(p.turnSeconds)} pensando em ${p.turns} turnos passados. O próximo turno vem por Sedex.`} />
        <Trophy emoji="💚" title="Plano de saúde" player={best('healing')} text={p => `Recuperou ${number(p.healing)} de vida. O SUS da mesa tem nome.`} />
        <Trophy emoji="📚" title="Só mais uma cartinha" player={best('draws')} text={p => `Comprou ${number(p.draws)} cartas. O grimório já pediu medida protetiva.`} />
        <Trophy emoji="🐿️" title="Fábrica de problemas" player={best('tokens')} text={p => `Criou ${number(p.tokens)} fichas. Abriu um CNPJ no campo.`} />
        <Trophy emoji="🎲" title="Devoto do D20" player={best('rolls')} text={p => `Rolou dados ${number(p.rolls)} vezes. A estratégia está nas mãos do destino.`} />
      </div>
      <h2 className="leaderboard-section-title">Hall da vergonha</h2>
      <div className="leaderboard-awards leaderboard-shame">
        <article className="leaderboard-award leaderboard-omission"><span className="leaderboard-emoji" aria-hidden="true">👻</span><div><h3>Top 1 mais omisso</h3><strong className="leaderboard-who">agiotagem</strong><p>Nunca jogou nenhuma partida. O único deck que pilota é o de desculpas.</p><small>Homenagem fixa da galera · campeão por ausência</small></div></article>
        <Trophy emoji="🔄" title="A mão nunca vem" player={best('mulligans')} text={p => `Pediu ${number(p.mulligans)} mulligans. O problema é sempre o embaralhamento, confia.`} />
        <Trophy emoji="🧊" title="O deck pediu férias" player={players.filter(p => p.streak < 0).sort((a, b) => a.streak - b.streak || a.id - b.id)[0]} text={p => `${-p.streak} derrotas seguidas em partidas com resultado. Já tentou culpar os sleeves?`} />
      </div>
      <h2 className="leaderboard-section-title">Últimas vitórias</h2>
      <div className="leaderboard-log">{model.data.recentWins.length ? model.data.recentWins.map((win, i) => <div key={`${win.playerId}-${win.at}-${i}`} style={color(win.playerId)}><p><strong>{win.name}</strong> levou a mesa com <b>{number(win.life)} de vida</b> e zero vergonha.</p><time dateTime={win.at}>{new Date(win.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div>) : <p className="leaderboard-empty">Sem vitórias confirmadas. Por enquanto, todo mundo é bom de discurso.</p>}</div>
      <details className="leaderboard-rules"><summary>Como contamos os vexames?</summary><p>Dados dos registros salvos, atualizados ao abrir a página ou trocar o período. Mês e semana (a partir de segunda) seguem o horário de Brasília e selecionam partidas iniciadas no período.</p><p>Dano soma reduções de vida, inclusive pagamentos e ajustes manuais; cura soma aumentos. Tempo soma turnos já passados, incluindo correções e períodos desconectados, sem contar o turno em andamento ou a preparação da mão. Empates nos troféus usam a ordem de cadastro.</p><p>Compras usam a ação Comprar, sem mão inicial ou mulligan. Alianças e motivos de desistência não são registrados. Os números não julgam jogadas: essa parte fica com os amigos.</p></details>
    </>}
    <footer>Uma mesa virtual. A mesma amizade. (Com rancor.)</footer>
  </div>;
}
