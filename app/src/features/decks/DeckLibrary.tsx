import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useCardInspection } from './useCardInspection';
import { useDecks } from './useDecks';
import './decks.css';

type Props = { library: ReturnType<typeof useDecks> };

export function DeckLibrary({ library }: Props) {
  const inspection = useCardInspection();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importOpen, setImportOpen] = useState(true);
  const chosen = library.decks.find(deck => deck.id === library.selected);
  const cardCount = chosen?.cards.reduce((sum, card) => sum + card.quantity, 0) ?? 0;

  useEffect(() => { if (!chosen) setImportOpen(true); }, [chosen]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file && !library.loading && !library.busy) {
      if (await library.upload(file)) {
        setImportOpen(false);
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
      }
    }
  }

  return <section className="deck-library" aria-labelledby="decks-title">
    <div className="section-intro">
      <div><p className="eyebrow">BIBLIOTECA</p><h2 id="decks-title">Seus decks, em um só lugar.</h2><p>Importe, consulte e organize seus decks Cockatrice.</p></div>
      <span className="deck-total">{library.decks.length} {library.decks.length === 1 ? 'deck salvo' : 'decks salvos'}</span>
    </div>
    <details className="import-card" open={importOpen} onToggle={event => setImportOpen(event.currentTarget.open)}>
      <summary><span>Importar deck</span><span className="import-summary-hint">{importOpen ? 'Ocultar' : 'Adicionar outro .cod'}</span></summary>
      <div className="import-content"><p>Arquivo .cod de até 2 MiB. Somente a seção principal será usada; sideboard e outras seções são ignorados.</p>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="deck-file">Arquivo .cod</label>
        <div className="upload-controls">
          <button type="button" className="secondary" disabled={library.busy} onClick={() => fileInput.current?.click()}>Selecionar arquivo</button>
          <span className="deck-filename">{file?.name ?? 'Nenhum arquivo selecionado'}</span>
          <button type="submit" disabled={!file || library.loading || library.busy}>{library.busy ? 'Salvando…' : 'Importar deck'}</button>
        </div>
        <input ref={fileInput} id="deck-file" type="file" accept=".cod" disabled={library.busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </form></div>
    </details>
    {library.error && <p role="alert" className="error">{library.error}</p>}
    {library.loading ? <p role="status">Carregando decks…</p> : library.decks.length === 0 ? <div className="empty-decks"><h3>Sua biblioteca começa aqui.</h3><p>Nenhum deck salvo. Importe seu primeiro arquivo.</p></div> : <div className="library-workspace">
      <div className="saved-deck-grid" aria-label="Decks salvos">{library.decks.map(deck => <button key={deck.id} type="button" className="saved-deck-card secondary" aria-pressed={library.selected === deck.id} onClick={() => { inspection.close(); library.setSelected(deck.id); }}>
        <span className="deck-emblem" aria-hidden="true">♧</span><span><strong>{deck.name}</strong><small>{deck.cards.reduce((sum, card) => sum + card.quantity, 0)} cartas</small></span><span aria-hidden="true">→</span>
      </button>)}</div>
      <div className="deck-picker">
        <label htmlFor="saved-deck">Escolher deck salvo</label>
        <select id="saved-deck" value={library.selected ?? ''} onChange={event => { inspection.close(); library.setSelected(event.target.value ? Number(event.target.value) : null); }}>
          <option value="">Selecione um deck</option>
          {library.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name} ({deck.cards.reduce((sum, card) => sum + card.quantity, 0)} cartas)</option>)}
        </select>
      </div>
      {chosen ? <article className="deck-detail">
        <div className="deck-detail-header">
          <div><p className="eyebrow">DECK SELECIONADO</p><h3>{chosen.name}</h3><p>{cardCount} cartas · {chosen.cards.length} nomes</p></div>
          <button type="button" className="secondary danger-button" disabled={library.busy} onClick={() => { inspection.close(); void library.remove(chosen.id); }}>Excluir deck</button>
        </div>
        <div className="deck-columns">
          <section className="deck-preview" aria-label="Preview de carta">
            {inspection.card ? <>
              <div className="preview-top"><span className="eyebrow">CARTA EM FOCO</span><button type="button" className="text-button" onClick={inspection.close}>Fechar consulta</button></div>
              <h4>{inspection.card.name}</h4>
              <p className="card-text">{inspection.card.text || 'O catálogo não informa texto para esta carta.'}</p>
              {!inspection.imageFailed && <img src={inspection.imageURL} alt={`Imagem ampliada de ${inspection.card.name}`} onError={inspection.reportImageFailure} />}
              {inspection.imageFailed && <p role="status">A imagem não está disponível agora. O texto da carta continua acessível.</p>}
            </> : <><span className="eyebrow">PREVIEW</span><h4>Conheça cada carta.</h4><p>Selecione uma carta na lista para ver o texto e a imagem aqui.</p></>}
          </section>
          <section className="deck-card-list" aria-label={`Cartas de ${chosen.name}`}>
            <div className="card-list-heading"><h4>Lista de cartas</h4><span>{chosen.cards.length} nomes</span></div>
            <ul>{chosen.cards.map(deckCard => <li key={deckCard.name}>
              <span className="card-quantity">{deckCard.quantity} × </span>
              <button type="button" className="card-link" aria-label={`Consultar ${deckCard.name}`} aria-pressed={inspection.card?.name === deckCard.name} onClick={() => inspection.inspect(deckCard)}>{deckCard.name}</button>
              {!deckCard.available && <strong>Indisponível no catálogo atual</strong>}
            </li>)}</ul>
          </section>
        </div>
      </article> : <div className="empty-decks"><h3>Escolha um deck para consultar.</h3><p>Os detalhes e as cartas aparecem aqui.</p></div>}
    </div>}
  </section>;
}
