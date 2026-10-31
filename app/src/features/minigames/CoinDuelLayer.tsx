import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CoinOptions, type CoinSide } from '../rooms/CoinOptions';
import { GameActionFooter } from '../rooms/GameActionFooter';
import { PanelHeader, TablePanel } from '../rooms/TablePanel';
import '../rooms/game-actions.css';
import './coin-duel.css';
import type { CoinDuel, CoinDuelNotice, useCoinDuels } from './useCoinDuels';

type Duels = ReturnType<typeof useCoinDuels>;

// Nada fecha o painel por engano: sair do X1 é sempre uma escolha explícita.
const stayOpen = () => {};

export function CoinDuelLayer({ duels, userId }: { duels: Duels; userId: number }) {
  // As regras dos painéis da mesa valem dentro de .match-board.
  return createPortal(<div className="match-board coin-duel-layer">
    {duels.own
      ? <DuelPanel key={duels.own.id} duel={duels.own} duels={duels} userId={userId} />
      : duels.target && <TablePanel open blocking label={`Desafiar ${duels.target.name}`} className="game-actions game-actions-coin coin-duel-panel" onClose={stayOpen}>
        <PanelHeader title={`X1 contra ${duels.target.name}`} subtitle="Cara ou coroa" closeLabel="Fechar desafio" onClose={duels.dismiss} />
        <p className="coin-duel-hint">Cada um escolhe um lado e confirma. A moeda decide, e a sala inteira vê o resultado.</p>
        {duels.error && <p role="alert" className="error">{duels.error}</p>}
        <GameActionFooter hideDivider onCancel={duels.dismiss} disabled={duels.pending} onConfirm={() => void duels.challenge(duels.target!.id)} label="Desafiar" />
      </TablePanel>}
    <section className="coin-duel-notices" aria-live="polite" aria-label="Resultados de X1">{duels.notices.map(notice => <Notice key={notice.key} notice={notice} />)}</section>
  </div>, document.body);
}

function DuelPanel({ duel, duels, userId }: { duel: CoinDuel; duels: Duels; userId: number }) {
  const challenger = duel.challengerId === userId;
  const opponentName = challenger ? duel.opponentName : duel.challengerName;
  const opponentId = challenger ? duel.opponentId : duel.challengerId;
  const mine = duel.confirmed[userId];
  const theirs = duel.confirmed[opponentId];
  const [picked, setPicked] = useState<CoinSide | null>(null);
  // Quem confirmou antes fica com o lado; a escolha em aberto do outro deixa de valer.
  useEffect(() => { if (!mine && theirs && picked === theirs) setPicked(null); }, [mine, theirs, picked]);
  const side = mine ?? picked;
  const status = duel.conflict
    ? `Os dois confirmaram ${mine}. Um de vocês precisa desconfirmar e trocar de lado.`
    : mine
      ? `Você confirmou ${mine}. Aguardando ${opponentName}.`
      : theirs
        ? `${opponentName} já confirmou ${theirs}. Sobrou o outro lado para você.`
        : side ? `Você escolheu ${side}. Confirme para valer.` : 'Escolha um lado.';
  return <TablePanel open blocking label={`X1 contra ${opponentName}`} className="game-actions game-actions-coin coin-duel-panel" onClose={stayOpen}>
    <PanelHeader title={`X1 contra ${opponentName}`} subtitle={challenger ? 'Seu desafio' : `${opponentName} desafiou você`} closeLabel={challenger ? 'Desistir do X1' : 'Recusar o X1'} onClose={() => void duels.cancel()} />
    {duels.error && <p role="alert" className="error">{duels.error}</p>}
    <div className="coin-form">
      <h3>Escolha um lado</h3>
      <CoinOptions value={side} onChange={setPicked} disabled={!!mine} blocked={mine ? undefined : theirs} />
      <p role={duel.conflict ? 'alert' : 'status'} className={duel.conflict ? 'coin-duel-conflict' : undefined}>{status}</p>
      <GameActionFooter cancelLabel={challenger ? 'Desistir' : 'Recusar'} onCancel={() => void duels.cancel()} disabled={duels.pending || !side} onConfirm={() => void (mine ? duels.unconfirm() : duels.confirm(side!))} label={mine ? 'Desconfirmar' : side ? `Confirmar ${side}` : 'Confirmar'} />
    </div>
  </TablePanel>;
}

function Notice({ notice }: { notice: CoinDuelNotice }) {
  const [spinning, setSpinning] = useState(notice.kind === 'result');
  useEffect(() => {
    if (!spinning) return;
    const timer = setTimeout(() => setSpinning(false), 1400);
    return () => clearTimeout(timer);
  }, [spinning]);
  if (notice.kind === 'cancelled') return <p className="coin-duel-notice is-cancelled">{notice.message}</p>;
  if (spinning) return <div className="coin-duel-notice"><span className="coin-duel-flip" aria-hidden="true" /><span>A moeda está no ar…</span></div>;
  return <div className="coin-duel-notice is-result"><small>Deu {notice.side}</small><strong>{notice.winnerName} venceu o X1</strong><span>contra {notice.loserName}</span></div>;
}
