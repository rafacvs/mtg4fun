import { useRef, useState, type FormEvent } from 'react';
import { useDecks } from './useDecks';
import './decks.css';

export function DeckLibrary() {
  const library = useDecks();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const chosen = library.decks.find(deck => deck.id === library.selected);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file && !library.loading && !library.busy) await library.upload(file);
  }
  return <section className="deck-library" aria-labelledby="decks-title">
    <h2 id="decks-title">Meus decks</h2>
    <p>Importe um arquivo Cockatrice .cod de até 2 MiB. Somente a seção principal será usada; sideboard e outras seções são ignorados.</p>
    <form onSubmit={event => void submit(event)}>
      <label htmlFor="deck-file">Arquivo .cod</label>
      <button type="button" className="secondary" disabled={library.busy} onClick={() => fileInput.current?.click()}>Selecionar arquivo</button>
      <span className="deck-filename">{file?.name ?? 'Nenhum arquivo selecionado'}</span>
      <input hidden ref={fileInput} id="deck-file" type="file" accept=".cod" disabled={library.busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
      <button type="submit" disabled={!file || library.loading || library.busy}>{library.busy ? 'Salvando…' : 'Importar deck'}</button>
    </form>
    {library.error && <p role="alert" className="error">{library.error}</p>}
    {library.loading ? <p role="status">Carregando decks…</p> : library.decks.length === 0 ? <p>Nenhum deck salvo. Importe seu primeiro arquivo.</p> : <>
      <label htmlFor="saved-deck">Escolher deck salvo</label>
      <select id="saved-deck" value={library.selected ?? ''} onChange={event => library.setSelected(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Selecione um deck</option>
        {library.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name} ({deck.cards.reduce((sum, card) => sum + card.quantity, 0)} cartas)</option>)}
      </select>
      {chosen && <article>
        <h3>{chosen.name}</h3>
        <ul>{chosen.cards.map(card => <li key={card.name}>{card.quantity} × {card.name}{!card.available && <strong> — indisponível no catálogo atual</strong>}</li>)}</ul>
        <button className="secondary" disabled={library.busy} onClick={() => void library.remove(chosen.id)}>Excluir deck</button>
      </article>}
    </>}
  </section>;
}
