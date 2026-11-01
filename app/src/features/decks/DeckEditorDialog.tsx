import type { Deck } from './deckApi';
import { DeckDetail } from './DeckDetail';
import type { useDecks } from './useDecks';
import { useModalDialog } from './useModalDialog';
import './decks.css';

type Props = { deck: Deck | undefined; open: boolean; library: ReturnType<typeof useDecks>; onClose: () => void };

export function DeckEditorDialog({ deck, open, library, onClose }: Props) {
  const dialog = useModalDialog(open);
  return <dialog ref={dialog} className="deck-editor-dialog" aria-label={deck ? `Editar ${deck.name}` : 'Editar deck'} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {open && library.error && <p role="alert" className="error">{library.error}</p>}
    {open && deck && <DeckDetail key={deck.id} deck={deck} library={library} actions={<button type="button" className="secondary" aria-label="Fechar edição do deck" onClick={onClose}>Fechar</button>} />}
  </dialog>;
}
