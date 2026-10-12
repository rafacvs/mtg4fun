import { useEffect, useRef, useState } from 'react';
import type { CustomToken } from './roomsApi';
import { cardImageURL } from './cardImage';
import { useCatalogTokens } from './useCatalogTokens';
import './library.css';
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

type View = 'menu' | 'catalog' | 'custom';

export function CreateInstances({ open, roomId, busy, error, onCreateToken, onCreateCustom, onClose }: Props) {
  const [view, setView] = useState<View>('menu');
  const [query, setQuery] = useState('');
  const catalog = useCatalogTokens(roomId, query, open && view === 'catalog');
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
    if (await operation()) setNotice('Ficha criada no seu campo.');
  }
  if (!open) return null;
  const title = view === 'catalog' ? 'Ficha do catálogo' : view === 'custom' ? 'Ficha personalizada' : 'Fichas';
  return <div className="actions-panel library-consultation" role="dialog" aria-modal="true" aria-label="Fichas">
    <header>
      <div><p className="actions-kicker">Ações</p><h2>{title}</h2></div>
      <button ref={closeRef} type="button" className="secondary" aria-label="Fechar fichas" onClick={onClose}>×</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {view !== 'menu' && <button type="button" className="text-button" onClick={() => setView('menu')}>Voltar</button>}
    {view === 'menu' && <div className="library-menu">
      <button type="button" onClick={() => setView('catalog')}><strong>Ficha do catálogo</strong><span>Buscar uma ficha que já existe.</span></button>
      <button type="button" onClick={() => setView('custom')}><strong>Ficha personalizada</strong><span>Nome, texto e poder/resistência.</span></button>
    </div>}
    {view === 'catalog' && <section className="grimorio-workspace" aria-label="Fichas do catálogo">
      <label className="library-search">Buscar ficha do catálogo<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      {catalog.error && <p role="alert">{catalog.error}</p>}
      {catalog.loading && <p role="status">Buscando fichas…</p>}
      {!catalog.loading && !catalog.error && catalog.tokens.length === 0 && <p className="library-empty">Nenhuma ficha encontrada.</p>}
      <ul className="token-list">{catalog.tokens.map(result => <li key={result.name}>
        <img src={cardImageURL(result)} alt="" onError={event => { if (!event.currentTarget.src.endsWith('/token-default.svg')) event.currentTarget.src = '/token-default.svg'; }} />
        <div>
          <strong>{result.name}</strong>
          {(result.power || result.toughness) && <span>{result.power || '—'} / {result.toughness || '—'}</span>}
          <button type="button" disabled={busy || catalog.loading} onClick={() => void create(() => onCreateToken(result.name))}>Criar {result.name}</button>
        </div>
      </li>)}</ul>
      <p className="library-order">Até 100 resultados. Refine a busca para localizar uma ficha.</p>
    </section>}
    {view === 'custom' && <form className="library-setup" onSubmit={event => { event.preventDefault(); void create(() => onCreateCustom(token)); }}>
      <label>Nome da ficha<input required maxLength={200} value={token.name} onChange={event => setToken({ ...token, name: event.target.value })} /></label>
      <label>Descrição da ficha<textarea maxLength={5000} value={token.description} onChange={event => setToken({ ...token, description: event.target.value })} /></label>
      <div className="token-stats">
        <label>Poder da ficha<input maxLength={32} value={token.power} onChange={event => setToken({ ...token, power: event.target.value })} /></label>
        <label>Resistência da ficha<input maxLength={32} value={token.toughness} onChange={event => setToken({ ...token, toughness: event.target.value })} /></label>
      </div>
      <button type="submit" disabled={busy || !token.name.trim()}>Criar ficha personalizada</button>
    </form>}
  </div>;
}
