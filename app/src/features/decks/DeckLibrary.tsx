import { useEffect, useState } from 'react';
import { useDecks } from './useDecks';
import { DeckDetail } from './DeckDetail';
import { DeckImportDialog } from './DeckImportDialog';
import { DeleteDeckConfirmation } from './DeleteDeckConfirmation';
import { deckApi } from './deckApi';
import './decks.css';

type Props = { library: ReturnType<typeof useDecks> };

export function DeckLibrary({ library }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);
  const chosen = library.decks.find(deck => deck.id === library.selected);

  useEffect(() => { if (!library.loading && library.decks.length === 0) setImportOpen(true); }, [library.loading, library.decks.length]);

  return <section className="deck-library" aria-labelledby="decks-title">
    <div className="deck-library-sidebar">
      <div className="section-intro">
        <div><p className="eyebrow">BIBLIOTECA</p><h2 id="decks-title">Seus decks</h2><p>Importe, consulte e organize seus decks Cockatrice.</p></div>
        <div className="deck-library-actions"><span className="deck-total">{library.decks.length} {library.decks.length === 1 ? 'deck salvo' : 'decks salvos'}</span><button type="button" aria-label="Abrir importação de deck" onClick={() => setImportOpen(true)}>Importar deck</button></div>
      </div>
      {library.error && !importOpen && <p role="alert" className="error">{library.error}</p>}
      {!library.loading && library.decks.length > 0 && <div className="saved-deck-grid" aria-label="Decks salvos"><label className="library-search"><span className="sr-only">Buscar deck</span><input placeholder="Buscar deck" value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /></label>{library.decks.filter(deck => deck.name.toLowerCase().includes(libraryQuery.toLowerCase())).map(deck => <button key={deck.id} type="button" className="saved-deck-card secondary" aria-pressed={library.selected === deck.id} onClick={() => library.setSelected(deck.id)}>
          <span className="deck-emblem" aria-hidden="true">{deck.cards.find(card => card.available) ? <img src={deckApi.imageURL(deck.commander || deck.cards.find(card => card.available)!.name)} alt="" /> : "♧"}</span>
          <span>
            <strong>{deck.name}</strong>
            <small>{deck.cards.reduce((sum, card) => sum + card.quantity, 0)} cartas</small>
            <small>{deck.cards.some(card => !card.available) ? `${deck.cards.filter(card => !card.available).length} nomes fora do catálogo` : 'Cartas no catálogo'}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>)}</div>}
    </div>
    <DeckImportDialog open={importOpen} library={library} onClose={() => setImportOpen(false)} />
    {deleting && <DeleteDeckConfirmation name={deleting.name} busy={library.busy} error={library.error} onConfirm={() => library.remove(deleting.id)} onClose={() => setDeleting(null)} />}
    {library.loading ? <p role="status" className="deck-library-main">Carregando decks…</p> : library.decks.length === 0 ? <div className="empty-decks deck-library-main"><h3>Sua biblioteca começa aqui.</h3><p>Nenhum deck salvo. Importe seu primeiro arquivo.</p></div> : <div className="library-workspace">
      <div className="deck-picker">
        <label htmlFor="saved-deck">Escolher deck salvo</label>
        <select id="saved-deck" value={library.selected ?? ''} onChange={event => library.setSelected(event.target.value ? Number(event.target.value) : null)}>
          <option value="">Selecione um deck</option>
          {library.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name} ({deck.cards.reduce((sum, card) => sum + card.quantity, 0)} cartas)</option>)}
        </select>
      </div>
      {chosen ? <DeckDetail key={chosen.id} deck={chosen} library={library} actions={<button type="button" className="secondary danger-button" disabled={library.busy} onClick={() => setDeleting({ id: chosen.id, name: chosen.name })}>Excluir deck</button>} /> : <div className="empty-decks"><h3>Escolha um deck para consultar.</h3><p>Os detalhes e as cartas aparecem aqui.</p></div>}
    </div>}
  </section>;
}
