import { useEffect, useRef, type FormEvent } from 'react';
import type { Deck } from '../decks/deckApi';
import type { RoomDraft } from './roomsApi';

export function CreateRoomPanel({ decks, busy, error, onCreate, onClose }: {
  decks: Deck[]; busy: boolean; error: string; onCreate: (draft: RoomDraft) => Promise<boolean>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const deckId = Number(data.get('deckId'));
    void onCreate({
      name: String(data.get('name') ?? ''),
      format: String(data.get('format') ?? ''),
      seats: Number(data.get('seats')),
      life: Number(data.get('life')),
      ...(deckId ? { deckId } : {}),
    }).then(created => { if (created) onClose(); });
  }
  return <dialog ref={dialog} className="create-room-panel" aria-labelledby="create-room-title" onCancel={onClose}>
    <form onSubmit={submit}>
      <header><div><p className="eyebrow">NOVA MESA</p><h2 id="create-room-title">Montar a mesa</h2></div><button type="button" className="text-button" onClick={onClose}>Fechar</button></header>
      <label htmlFor="create-room-name">Nome da mesa</label>
      <input id="create-room-name" name="name" required placeholder="Sábado entre amigos" />
      <label htmlFor="create-room-format">Formato</label>
      <select id="create-room-format" name="format" defaultValue="Commander"><option>Commander</option><option>Livre</option><option>Duelo</option></select>
      <div className="create-room-numbers"><div><label htmlFor="create-room-seats">Lugares</label><input id="create-room-seats" name="seats" type="number" min="1" max="6" defaultValue="4" required /></div><div><label htmlFor="create-room-life">Vida inicial</label><input id="create-room-life" name="life" type="number" min="1" max="999" defaultValue="40" required /></div></div>
      <label htmlFor="create-room-deck">Seu deck</label>
      <select id="create-room-deck" name="deckId" defaultValue=""><option value="">Escolher na preparação</option>{decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Criando…' : 'Criar e sentar'}</button>
    </form>
  </dialog>;
}
