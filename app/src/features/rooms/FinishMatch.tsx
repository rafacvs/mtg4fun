import { useEffect, useRef, useState } from 'react';
import type { Match } from './roomsApi';
import './finish.css';

export function FinishMatch({ match, busy, unconfirmed, error, onConfirm, onRetry }: {
  match: Match;
  busy: boolean;
  unconfirmed: boolean;
  error: string;
  onConfirm: () => Promise<boolean>;
  onRetry: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const voted = match.finishVotes.includes(match.viewerId);
  useEffect(() => {
    if (open) { dialog.current?.showModal(); cancel.current?.focus(); }
    else dialog.current?.close();
  }, [open]);
  const confirm = async () => { if (await onConfirm()) setOpen(false); };
  return <>
    <button type="button" className="finish-button" disabled={busy || unconfirmed} onClick={() => setOpen(true)} title="Solicitar ou confirmar o encerramento da partida">Finalizar{match.finishVotes.length > 0 && ` (${match.finishVotes.length}/${match.finishRequired})`}</button>
    {open && <dialog ref={dialog} className="finish-dialog" role="dialog" aria-labelledby="finish-title" aria-describedby="finish-description" onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }}>
      <h2 id="finish-title">Finalizar partida?</h2>
      <p id="finish-description">Ao atingir pelo menos metade dos {match.players.length} jogador(es), a partida será finalizada e a sala encerrada para todos. O estado final e o registro serão preservados.</p>
      <p>{match.finishVotes.length} de {match.finishRequired} concordância(s) necessária(s).</p>
      {voted ? <p role="status">Você já concordou. Aguardando os outros jogadores.</p> : <p>Sua confirmação conta como uma concordância.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="finish-dialog-actions">
        <button ref={cancel} type="button" className="secondary" disabled={busy} onClick={() => setOpen(false)}>{voted ? 'Voltar à partida' : 'Cancelar'}</button>
        {unconfirmed ? <button type="button" className="finish-button" disabled={busy} onClick={async () => { if (await onRetry()) setOpen(false); }}>Tentar novamente</button>
          : !voted && <button type="button" className="finish-button" disabled={busy} onClick={() => void confirm()}>Concordar e finalizar</button>}
      </div>
    </dialog>}
  </>;
}
