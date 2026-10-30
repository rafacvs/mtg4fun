import { useRef, useState } from 'react';
import { MenuItem, PanelHeader, PanelResult, usePanelFocus } from './TablePanel';
import { TableIcon } from './TableIcon';
import type { CatalogToken, CustomToken } from './roomsApi';
import { cardImageURL } from './cardImage';
import { useCatalogTokens } from './useCatalogTokens';
import './library.css';
import './creations.css';

export type TokenView = 'token' | 'token-catalog' | 'token-custom';

type Props = {
  view: TokenView;
  roomId: number;
  busy: boolean;
  onView: (view: TokenView) => void;
  onPreview: (token: CatalogToken) => void;
  onCreateToken: (name: string) => Promise<boolean>;
  onCreateCustom: (token: CustomToken) => Promise<boolean>;
};

const catalogLimit = 100;

// Token creation screens, shown inside the game actions popover.
export function CreateInstances({ view, roomId, busy, onView, onPreview, onCreateToken, onCreateCustom }: Props) {
  const [query, setQuery] = useState('');
  const catalog = useCatalogTokens(roomId, query, view === 'token-catalog');
  const [token, setToken] = useState<CustomToken>({ name: '', description: '', power: '', toughness: '' });
  const [notice, setNotice] = useState('');

  async function create(operation: () => Promise<boolean>) {
    setNotice('');
    if (await operation()) setNotice('Ficha criada no seu campo.');
  }
  return <>
    {view === 'token' && <div className="table-menu">
      <MenuItem icon="search" title="Ficha do catálogo" description="Buscar uma ficha que já existe" onClick={() => onView('token-catalog')} />
      <MenuItem icon="token" title="Ficha personalizada" description="Nome, texto e poder/resistência" onClick={() => onView('token-custom')} />
    </div>}
    {view === 'token-catalog' && <section className="creations-catalog" aria-label="Fichas do catálogo">
      <div className="search-field">
        <TableIcon name="search" />
        <input aria-label="Buscar ficha do catálogo" placeholder="Buscar por nome" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" className="secondary" aria-label="Limpar busca" onClick={() => setQuery('')}><TableIcon name="close" /></button>}
      </div>
      {catalog.error && <p role="alert" className="error">{catalog.error}</p>}
      <p className="panel-hint" role="status">{catalog.loading ? 'Buscando fichas…' : catalog.tokens.length >= catalogLimit ? `${catalogLimit} fichas · refine a busca` : `${catalog.tokens.length} ficha${catalog.tokens.length === 1 ? '' : 's'}`}</p>
      {!catalog.loading && !catalog.error && catalog.tokens.length === 0 && <p className="library-empty">Nenhuma ficha encontrada.</p>}
      {catalog.tokens.length > 0 && <ul className="token-list">{catalog.tokens.map(result => <li key={result.name}>
        <TokenThumb token={result} onInspect={onPreview} />
        <div className="token-info">
          <strong>{result.name}</strong>
          {(result.power || result.toughness) && <span>{result.power || '—'} / {result.toughness || '—'}</span>}
        </div>
        <button type="button" className="secondary token-create" disabled={busy || catalog.loading} onClick={() => void create(() => onCreateToken(result.name))}><TableIcon name="token" /><span>Criar</span></button>
      </li>)}</ul>}
    </section>}
    {view === 'token-custom' && <form className="creations-form" onSubmit={event => { event.preventDefault(); void create(() => onCreateCustom(token)); }}>
      <label>Nome da ficha<input required maxLength={200} placeholder="Ex.: Dragão amigo" value={token.name} onChange={event => setToken({ ...token, name: event.target.value })} /></label>
      <label>Descrição da ficha<textarea maxLength={5000} placeholder="Opcional" value={token.description} onChange={event => setToken({ ...token, description: event.target.value })} /></label>
      <div className="token-stats">
        <label>Poder da ficha<input type="number" step="1" placeholder="—" value={token.power} onChange={event => setToken({ ...token, power: event.target.value })} /></label>
        <span className="pt-slash" aria-hidden="true">/</span>
        <label>Resistência da ficha<input type="number" step="1" placeholder="—" value={token.toughness} onChange={event => setToken({ ...token, toughness: event.target.value })} /></label>
      </div>
      <button type="submit" className="panel-primary" disabled={busy || !token.name.trim()}>Criar ficha</button>
    </form>}
    {notice && <PanelResult>{notice}</PanelResult>}
  </>;
}

export function CatalogTokenPreview({ token, onClose }: { token: CatalogToken; onClose: () => void }) {
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
