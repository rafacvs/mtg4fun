import { useState } from 'react';
import { useDecks } from './useDecks';
import { DeckDetail } from './DeckDetail';
import { DeckImportDialog } from './DeckImportDialog';
import { DeleteDeckConfirmation } from './DeleteDeckConfirmation';
import { deckApi } from './deckApi';
import { DeckEditorDialog } from './DeckEditorDialog';
import './decks.css';

type Props = { library: ReturnType<typeof useDecks> };

export function DeckLibrary({ library }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const chosen = library.decks.find(deck => deck.id === library.selected);
  const filtered = library.decks.filter(deck => deck.name.toLowerCase().includes(libraryQuery.toLowerCase()) || deck.cards.some(card => card.name.toLowerCase().includes(libraryQuery.toLowerCase())));
  function create() { void library.createDraft().then(deck => { if (deck) { setShowDetail(true); setEditing(deck.id); } }); }
  return <section className="deck-collection" aria-labelledby="decks-title">
    <header className="collection-heading"><div><p className="eyebrow">SUA BIBLIOTECA</p><h2 id="decks-title">Seus decks</h2><p>Escolha um deck e prepare sua próxima partida.</p></div><div className="collection-heading-actions"><button type="button" className="secondary" aria-label="Abrir importação de deck" onClick={() => setImportOpen(true)}>Importar .cod</button><button type="button" onClick={create}>+ Criar deck</button></div></header>
    {library.error && !importOpen && <p role="alert" className="error">{library.error}</p>}
    <DeckImportDialog open={importOpen} library={library} onClose={() => setImportOpen(false)} onImported={() => setShowDetail(true)} />
    {deleting && <DeleteDeckConfirmation name={deleting.name} busy={library.busy} error={library.error} onConfirm={async () => { const removed = await library.remove(deleting.id); if (removed) setShowDetail(false); return removed; }} onClose={() => setDeleting(null)} />}
    {library.loading ? <p role="status">Carregando decks…</p> : showDetail && chosen ? <div className="collection-detail"><button type="button" className="collection-back" onClick={() => setShowDetail(false)}>← Todos os decks</button><DeckDetail key={chosen.id} deck={chosen} library={library} onEdit={() => setEditing(chosen.id)} actions={<><button type="button" onClick={() => setEditing(chosen.id)}>Editar deck</button><button type="button" className="secondary danger-button" disabled={library.busy} onClick={() => setDeleting({ id: chosen.id, name: chosen.name })}>Excluir deck</button></>} /></div> : <>
      <div className="collection-toolbar"><div><p className="eyebrow">SUA COLEÇÃO</p><h3>Escolha seu próximo deck <span>{library.decks.length}</span></h3></div><label><span className="sr-only">Buscar deck</span><input placeholder="Buscar por deck ou carta" value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /></label></div>
      {library.decks.length === 0 ? <div className="collection-empty"><span aria-hidden="true">✧</span><h3>Sua coleção começa aqui</h3><p>Crie um deck do zero ou traga suas cartas de um arquivo Cockatrice.</p><button type="button" onClick={create}>Criar meu primeiro deck</button></div> : filtered.length === 0 ? <p className="collection-no-results">Nenhum deck encontrado para essa busca.</p> : <div className="collection-grid" aria-label="Decks salvos">{filtered.map(deck => {
        const cover = deck.cards.find(card => card.available && card.name === deck.commander) || deck.cards.find(card => card.available);
        const count = deck.cards.reduce((sum, card) => sum + card.quantity, 0);
        const pending = deck.cards.filter(card => !card.available).length;
        return <article className="collection-card" key={deck.id}><button type="button" className="collection-card-open" aria-label={`Abrir ${deck.name}`} onClick={() => { library.setSelected(deck.id); setShowDetail(true); }}><span className="collection-cover"><span className="collection-cover-back" aria-hidden="true">✧<small>MTG4FUN</small></span>{cover && <img src={deckApi.imageURL(cover.name)} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} />}<span className="collection-cover-shade" /><span className="collection-cover-label">{deck.commander ? 'COMANDANTE' : cover ? 'CARTA DO DECK' : 'DECK VAZIO'}</span></span><span className="collection-card-info"><strong>{deck.name}</strong><small>{count} cartas <span>·</span> {deck.commander ? deck.commander : deck.colorIdentity ? `Identidade ${deck.colorIdentity}` : 'Sem comandante'}</small><small className={pending ? 'collection-pending' : ''}>{pending ? `${pending} ${pending === 1 ? 'nome precisa' : 'nomes precisam'} de atenção` : 'Cartas no catálogo'}</small></span></button><button type="button" className="collection-card-edit" aria-label={`Editar ${deck.name}`} onClick={() => { library.setSelected(deck.id); setEditing(deck.id); }}>Editar <span aria-hidden="true">↗</span></button></article>;
      })}</div>}
    </>}
    <DeckEditorDialog deck={library.decks.find(deck => deck.id === editing)} open={editing !== null} library={library} onClose={() => setEditing(null)} />
  </section>;
}
