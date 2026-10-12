import { useEffect, useRef, useState } from 'react';
import type { CustomToken } from './roomsApi';
import { cardImageURL } from './cardImage';
import { useCatalogTokens } from './useCatalogTokens';
import './creations.css';

type Props = {
  open: boolean;
  roomId: number;
  busy: boolean;
  error: string;
  onCreateToken: (name: string) => Promise<boolean>;
  onCreateCustom: (token: CustomToken) => Promise<boolean>;
  onClose: () => void;
};

export function CreateInstances({ open, roomId, busy, error, onCreateToken, onCreateCustom, onClose }: Props) {
  const [query, setQuery] = useState('');
  const catalog = useCatalogTokens(roomId, query, open);
  const [token, setToken] = useState<CustomToken>({ name: '', description: '', power: '', toughness: '' });
  const [notice, setNotice] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function create(operation: () => Promise<boolean>) {
    setNotice('');
    if (await operation()) setNotice('Instância criada no seu campo.');
  }
  if (!open) return null;
  return <div className="creation-backdrop">
    <section className="creation-panel" role="dialog" aria-modal="true" aria-label="Fichas e cópias">
      <header><h2>Fichas e cópias</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar fichas e cópias">Fechar</button></header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <p>As instâncias entram no seu campo. Para copiar uma carta, abra sua imagem e escolha criar cópia independente.</p>
      <section aria-label="Fichas do catálogo">
        <h3>Catálogo compartilhado</h3>
        <label>Buscar ficha do catálogo<input value={query} onChange={event => setQuery(event.target.value)} /></label>
        {catalog.error && <p role="alert">{catalog.error}</p>}
        {catalog.loading && <p role="status">Buscando fichas…</p>}
        {!catalog.loading && !catalog.error && catalog.tokens.length === 0 && <p>Nenhuma ficha encontrada.</p>}
        <ul className="token-results">{catalog.tokens.map(result => <li key={result.name}>
          <img src={cardImageURL(result)} alt={`Imagem de ${result.name}`} onError={event => { if (!event.currentTarget.src.endsWith('/token-default.svg')) event.currentTarget.src = '/token-default.svg'; }} />
          <div><strong>{result.name}</strong>{result.text && <p className="instance-text">{result.text}</p>}{(result.power || result.toughness) && <p>{result.power || '—'} / {result.toughness || '—'}</p>}
            <button type="button" disabled={busy || catalog.loading} onClick={() => void create(() => onCreateToken(result.name))}>Criar {result.name}</button>
          </div>
        </li>)}</ul>
        <small>Até 100 resultados. Refine a busca para localizar uma ficha.</small>
      </section>
      <form onSubmit={event => { event.preventDefault(); void create(() => onCreateCustom(token)); }}>
        <h3>Ficha personalizada</h3>
        <label>Nome da ficha<input required maxLength={200} value={token.name} onChange={event => setToken({ ...token, name: event.target.value })} /></label>
        <label>Descrição da ficha<textarea maxLength={5000} value={token.description} onChange={event => setToken({ ...token, description: event.target.value })} /></label>
        <div className="token-stats"><label>Poder da ficha<input maxLength={32} value={token.power} onChange={event => setToken({ ...token, power: event.target.value })} /></label><label>Resistência da ficha<input maxLength={32} value={token.toughness} onChange={event => setToken({ ...token, toughness: event.target.value })} /></label></div>
        <button type="submit" disabled={busy || !token.name.trim()}>Criar ficha personalizada</button>
      </form>
    </section>
  </div>;
}
