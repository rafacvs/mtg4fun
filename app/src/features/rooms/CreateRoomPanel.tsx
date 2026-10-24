import { useEffect, useRef } from 'react';
import type { Deck } from '../decks/deckApi';

export function CreateRoomPanel({ decks, busy, error, onCreate, onClose }: {
  decks: Deck[]; busy: boolean; error: string; onCreate: () => Promise<boolean>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="create-room-panel" aria-labelledby="create-room-title" onCancel={onClose}>
    <form onSubmit={event => { event.preventDefault(); void onCreate().then(created => { if (created) onClose(); }); }}>
      <header><div><p className="eyebrow">NOVA MESA</p><h2 id="create-room-title">Montar a mesa</h2></div><button type="button" className="text-button" onClick={onClose}>Fechar</button></header>
      <p className="example-note">Os campos abaixo são exemplos de apresentação. A sala é criada com o nome automático e as configurações atuais; você já entra sentado e confirma seu deck na preparação.</p>
      <label htmlFor="create-room-name">Nome da mesa · exemplo</label>
      <input id="create-room-name" placeholder="Sábado entre amigos" />
      <label htmlFor="create-room-format">Formato · exemplo</label>
      <select id="create-room-format" defaultValue="Commander"><option>Commander</option><option>Livre</option><option>Duelo</option></select>
      <div className="create-room-numbers"><div><label htmlFor="create-room-seats">Lugares · exemplo</label><input id="create-room-seats" type="number" min="1" max="6" defaultValue="4" /></div><div><label htmlFor="create-room-life">Vida inicial · exemplo</label><input id="create-room-life" type="number" defaultValue="40" /></div></div>
      <label htmlFor="create-room-deck">Seu deck · exemplo</label>
      <select id="create-room-deck" defaultValue=""><option value="">Escolher na preparação</option>{decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Criando…' : 'Criar e sentar'}</button>
    </form>
  </dialog>;
}
