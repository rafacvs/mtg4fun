import { useState } from 'react';
import { PanelResult } from './TablePanel';
import { TableIcon } from './TableIcon';
import type { CatalogToken, CustomToken } from './roomsApi';
import { cardImageURL } from './cardImage';
import { useCatalogTokens } from './useCatalogTokens';
import './library.css';
import './creations.css';

type Tab = 'catalog' | 'custom';

type Props = {
  roomId: number;
  busy: boolean;
  actorName: string;
  onCreateToken: (name: string) => Promise<boolean>;
  onCreateCustom: (token: CustomToken) => Promise<boolean>;
};

const catalogLimit = 100;
const tabs: { id: Tab; label: string; icon: 'search' | 'edit' }[] = [
  { id: 'catalog', label: 'Do catálogo', icon: 'search' },
  { id: 'custom', label: 'Personalizada', icon: 'edit' },
];

function statsLabel(power?: string, toughness?: string) {
  return power || toughness ? `${power || '—'}/${toughness || '—'}` : '';
}

// Token creation inside the game actions popover: catalog and custom share one screen.
export function CreateInstances({ roomId, busy, actorName, onCreateToken, onCreateCustom }: Props) {
  const [tab, setTab] = useState<Tab>('catalog');
  const [query, setQuery] = useState('');
  const catalog = useCatalogTokens(roomId, query, tab === 'catalog');
  const [token, setToken] = useState<CustomToken>({ name: '', description: '', power: '', toughness: '' });
  const [result, setResult] = useState('');

  async function create(operation: () => Promise<boolean>, name: string, stats: string) {
    setResult('');
    if (await operation()) setResult(`${actorName} criou a ficha ${name}${stats ? ` (${stats})` : ''}.`);
  }
  const step = (field: 'power' | 'toughness', delta: number) => setToken(current => ({ ...current, [field]: String((Number(current[field]) || 0) + delta) }));
  return <div className="token-creation">
    <div className="segmented token-tabs" role="tablist" aria-label="Tipo de ficha">
      {tabs.map(item => <button key={item.id} type="button" role="tab" id={`token-tab-${item.id}`} aria-controls={`token-panel-${item.id}`} aria-selected={tab === item.id} onClick={() => setTab(item.id)}><TableIcon name={item.icon} /><span>{item.label}</span></button>)}
    </div>
    {tab === 'catalog' && <section className="creations-catalog" role="tabpanel" id="token-panel-catalog" aria-labelledby="token-tab-catalog">
      <div className="catalog-search">
        <div className="search-field">
          <TableIcon name="search" />
          <input aria-label="Buscar ficha do catálogo" placeholder="Buscar ficha pelo nome: Angel, Treasure…" value={query} onChange={event => setQuery(event.target.value)} />
          {query && <button type="button" className="secondary" aria-label="Limpar busca" onClick={() => setQuery('')}><TableIcon name="close" /></button>}
        </div>
        <p className="catalog-count" role="status">{catalog.loading ? 'Buscando…' : <><strong>{catalog.tokens.length}{catalog.tokens.length >= catalogLimit ? '+' : ''}</strong> ficha{catalog.tokens.length === 1 ? '' : 's'}</>}</p>
      </div>
      {catalog.error && <p role="alert" className="error">{catalog.error}</p>}
      {!catalog.loading && !catalog.error && catalog.tokens.length === 0 && <p className="library-empty">Nenhuma ficha encontrada.</p>}
      {catalog.tokens.length > 0 && <ul className="token-grid">{catalog.tokens.map(item => {
        const stats = statsLabel(item.power, item.toughness);
        return <li key={item.name}>
          <button type="button" className="token-tile" aria-label={`Criar ${item.name}`} disabled={busy || catalog.loading} onClick={() => void create(() => onCreateToken(item.name), item.name, stats)}>
            <TokenArt token={item} />
            {stats && <span className="token-stats-badge" aria-label={`Poder e resistência ${stats}`}>{stats}</span>}
            <span className="token-create-hint" aria-hidden="true"><TableIcon name="plus" />Criar</span>
          </button>
          <strong className="token-name">{item.name}</strong>
        </li>;
      })}</ul>}
      <div className="token-footer">
        {result ? <PanelResult>{result}</PanelResult> : <span />}
        <small>clique na ficha para criar</small>
      </div>
    </section>}
    {tab === 'custom' && <form className="creations-form" role="tabpanel" id="token-panel-custom" aria-labelledby="token-tab-custom" onSubmit={event => { event.preventDefault(); void create(() => onCreateCustom(token), token.name.trim(), statsLabel(token.power, token.toughness)); }}>
      <label className="form-field"><span className="form-label">Nome da ficha</span><input required maxLength={200} placeholder="Ex.: Espírito" value={token.name} onChange={event => setToken({ ...token, name: event.target.value })} /></label>
      <label className="form-field"><span className="form-label">Descrição<small>opcional</small></span><textarea aria-label="Descrição da ficha" maxLength={5000} value={token.description} onChange={event => setToken({ ...token, description: event.target.value })} /></label>
      <div className="form-field" role="group" aria-labelledby="token-stats-label">
        <span className="form-label" id="token-stats-label">Poder / Resistência<small>vazio para fichas sem P/R</small></span>
        <div className="token-stats">
          {(['power', 'toughness'] as const).map((field, index) => <div key={field} className="small-stepper">
            {index === 1 && <span className="pt-slash" aria-hidden="true">/</span>}
            <button type="button" className="secondary" aria-label={`Diminuir ${field === 'power' ? 'poder' : 'resistência'}`} onClick={() => step(field, -1)}>−</button>
            <input aria-label={field === 'power' ? 'Poder da ficha' : 'Resistência da ficha'} type="number" step="1" placeholder="—" value={token[field]} onChange={event => setToken({ ...token, [field]: event.target.value })} />
            <button type="button" className="secondary" aria-label={`Aumentar ${field === 'power' ? 'poder' : 'resistência'}`} onClick={() => step(field, 1)}>+</button>
          </div>)}
        </div>
      </div>
      <button type="submit" className="panel-primary" disabled={busy || !token.name.trim()}><TableIcon name="plus" /><span>Criar ficha</span></button>
      <p className="form-caption">A ficha entra no seu campo.</p>
      {result && <PanelResult>{result}</PanelResult>}
    </form>}
  </div>;
}

function TokenArt({ token }: { token: CatalogToken }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <span className="token-art token-art-fallback">{token.name}</span>
    : <img className="token-art" src={cardImageURL(token)} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
