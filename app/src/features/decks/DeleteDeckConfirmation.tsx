import { useEffect, useRef } from 'react';

export function DeleteDeckConfirmation({ name, busy, error, onConfirm, onClose }: {
  name: string; busy: boolean; error: string; onConfirm: () => Promise<boolean>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="delete-deck-confirmation" aria-labelledby="delete-deck-title" onCancel={onClose}>
    <h2 id="delete-deck-title">Excluir deck?</h2>
    <p>Excluir <strong>{name}</strong> da sua biblioteca?</p>
    <p>Uma partida já iniciada não muda. As cartas que já entraram na partida continuam na mesa.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <div><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="button" className="secondary danger-button" disabled={busy} onClick={() => void onConfirm().then(removed => { if (removed) onClose(); })}>{busy ? 'Excluindo…' : 'Confirmar exclusão'}</button></div>
  </dialog>;
}
