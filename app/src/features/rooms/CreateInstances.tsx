import { useRef, useState } from 'react';
import { MenuItem, PanelHeader, TablePanel, usePanelFocus } from './TablePanel';
import type { CatalogToken, CustomToken } from './roomsApi';
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
  const [preview, setPreview] = useState<CatalogToken | null>(null);

  async function create(operation: () => Promise<boolean>) {
    setNotice('');
    if (await operation()) setNotice('Ficha criada no seu campo.');
  }
  if (!open) return null;
  const title = view === 'catalog' ? 'Ficha do catálogo' : view === 'custom' ? 'Ficha personalizada' : 'Fichas';
  return <>
    <TablePanel open={open} label="Fichas" className="creations-panel" onClose={onClose}>
      <PanelHeader title={title} subtitle={view === 'menu' ? 'Criar no seu campo' : 'Fichas'} closeLabel="Fechar fichas" onClose={() => { setPreview(null); onClose(); }} onBack={view !== 'menu' ? () => { setPreview(null); setView('menu'); } : undefined} />
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="panel-result">{notice}</p>}
      {view === 'menu' && <div className="table-menu">
        <MenuItem icon="search" title="Ficha do catálogo" description="Buscar uma ficha que já existe" onClick={() => setView('catalog')} />
        <MenuItem icon="token" title="Ficha personalizada" description="Nome, texto e poder/resistência" onClick={() => setView('custom')} />
      </div>}
      {view === 'catalog' && <section className="creations-catalog" aria-label="Fichas do catálogo">
        <label className="library-search">Buscar ficha do catálogo<input value={query} onChange={event => setQuery(event.target.value)} /></label>
        {catalog.error && <p role="alert" className="error">{catalog.error}</p>}
        {catalog.loading && <p role="status" className="panel-hint">Buscando fichas…</p>}
        {!catalog.loading && !catalog.error && catalog.tokens.length === 0 && <p className="library-empty">Nenhuma ficha encontrada.</p>}
        <ul className="token-list">{catalog.tokens.map(result => <li key={result.name}>
          <TokenThumb token={result} onInspect={setPreview} />
          <div>
            <strong>{result.name}</strong>
            {(result.power || result.toughness) && <span>{result.power || '—'} / {result.toughness || '—'}</span>}
            <button type="button" disabled={busy || catalog.loading} onClick={() => void create(() => onCreateToken(result.name))}>Criar</button>
          </div>
        </li>)}</ul>
        <p className="library-order">Até 100 resultados. Refine a busca para localizar uma ficha.</p>
      </section>}
      {view === 'custom' && <form className="creations-form" onSubmit={event => { event.preventDefault(); void create(() => onCreateCustom(token)); }}>
        <label>Nome da ficha<input required maxLength={200} value={token.name} onChange={event => setToken({ ...token, name: event.target.value })} /></label>
        <label>Descrição da ficha<textarea maxLength={5000} value={token.description} onChange={event => setToken({ ...token, description: event.target.value })} /></label>
        <div className="token-stats">
          <label>Poder da ficha<input type="number" step="1" value={token.power} onChange={event => setToken({ ...token, power: event.target.value })} /></label>
          <label>Resistência da ficha<input type="number" step="1" value={token.toughness} onChange={event => setToken({ ...token, toughness: event.target.value })} /></label>
        </div>
        <button type="submit" disabled={busy || !token.name.trim()}>Criar ficha personalizada</button>
      </form>}
    </TablePanel>
    {preview && <CatalogTokenPreview token={preview} onClose={() => setPreview(null)} />}
  </>;
}

function CatalogTokenPreview({ token, onClose }: { token: CatalogToken; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  usePanelFocus(ref, true, onClose);
  return <div className="card-preview-backdrop" onClick={onClose}>
    <div ref={ref} className="card-preview" role="dialog" aria-modal="true" aria-label={`Imagem de ${token.name}`} onClick={event => event.stopPropagation()}>
      <div className="card-preview-image"><img src={cardImageURL(token)} alt={`Imagem ampliada de ${token.name}`} /></div>
      <div className="card-preview-actions">
        <PanelHeader title={token.name} subtitle="Ficha do catálogo" closeLabel="Fechar" onClose={onClose} />
        {(token.power || token.toughness) && <p className="panel-readout">{token.power || '—'} / {token.toughness || '—'}</p>}
      </div>
    </div>
  </div>;
}

function TokenThumb({ token, onInspect }: { token: CatalogToken; onInspect: (token: CatalogToken) => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="token-thumb" aria-label={`Ver imagem de ${token.name}`} onClick={() => onInspect(token)}>
    {failed
      ? <span>{token.name}</span>
      : <img src={cardImageURL(token)} alt="" onError={() => setFailed(true)} />}
  </button>;
}
