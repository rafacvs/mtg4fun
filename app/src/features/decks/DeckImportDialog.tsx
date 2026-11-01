import { useRef, useState, type FormEvent } from 'react';
import type { Deck } from './deckApi';
import type { useDecks } from './useDecks';
import { useModalDialog } from './useModalDialog';
import './decks.css';

type Props = { open: boolean; library: ReturnType<typeof useDecks>; onClose: () => void; onImported?: (deck: Deck) => void };

export function DeckImportDialog({ open, library, onClose, onImported }: Props) {
  const dialog = useModalDialog(open);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file && !library.loading && !library.busy) {
      const deck = await library.upload(file);
      if (deck) {
        onClose();
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
        onImported?.(deck);
      }
    }
  }

  return <dialog ref={dialog} className="import-card import-dialog" aria-labelledby="import-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="import-dialog-header"><div><p className="eyebrow">BIBLIOTECA</p><h3 id="import-dialog-title">Importar deck</h3></div><button type="button" className="secondary" aria-label="Fechar importação" onClick={onClose}>Fechar</button></div>
    {open && library.error && <p role="alert" className="error">{library.error}</p>}
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
  </dialog>;
}
