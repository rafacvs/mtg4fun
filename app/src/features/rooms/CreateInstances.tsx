import { useState } from 'react';
import { PanelResult } from './TablePanel';
import { GameActionFooter } from './GameActionFooter';
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
  onCancel: () => void;
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
export function CreateInstances({ roomId, busy, actorName, onCancel, onCreateToken, onCreateCustom }: Props) {
  const [tab, setTab] = useState<Tab>('catalog');
  const [query, setQuery] = useState('');
  const catalog = useCatalogTokens(roomId, query, tab === 'catalog');
  const [token, setToken] = useState<CustomToken>({ name: '', description: '', power: '', toughness: '' });
  const [pair, setPair] = useState('');
  const pairMatch = /^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/.exec(pair);
  const validPair = !pair.trim() || Boolean(pairMatch && Number.isSafeInteger(Number(pairMatch[1])) && Number.isSafeInteger(Number(pairMatch[2])));
  const [result, setResult] = useState('');
  const [selected, setSelected] = useState<CatalogToken | null>(null);

  async function create(operation: () => Promise<boolean>, name: string, stats: string) {
    setResult('');
    if (await operation()) setResult(`${actorName} criou a ficha ${name}${stats ? ` (${stats})` : ''}.`);
  }
  const updatePair = (value: string) => {
    setPair(value);
    const parsed = /^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/.exec(value);
    if (!value.trim()) setToken(current => ({ ...current, power: '', toughness: '' }));
    else if (parsed && Number.isSafeInteger(Number(parsed[1])) && Number.isSafeInteger(Number(parsed[2]))) setToken(current => ({ ...current, power: parsed[1], toughness: parsed[2] }));
  };
  const step = (delta: number) => {
    if (!validPair) return;
    const power = (pairMatch ? Number(pairMatch[1]) : 0) + delta;
    const toughness = (pairMatch ? Number(pairMatch[2]) : 0) + delta;
    if (Number.isSafeInteger(power) && Number.isSafeInteger(toughness)) updatePair(`${power}/${toughness}`);
  };
  return <div className="token-creation">
    <div className="segmented token-tabs" role="tablist" aria-label="Tipo de ficha">
      {tabs.map(item => <button key={item.id} type="button" role="tab" id={`token-tab-${item.id}`} aria-controls={`token-panel-${item.id}`} aria-selected={tab === item.id} onClick={() => { setTab(item.id); setResult(''); }}><TableIcon name={item.icon} /><span>{item.label}</span></button>)}
    </div>
    {tab === 'catalog' && <section className="creations-catalog" role="tabpanel" id="token-panel-catalog" aria-labelledby="token-tab-catalog">
      <div className="catalog-search">
        <div className="search-field">
          <TableIcon name="search" />
          <input aria-label="Buscar ficha do catálogo" placeholder="Buscar ficha pelo nome: Angel, Treasure…" value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} />
          {query && <button type="button" className="secondary" aria-label="Limpar busca" onClick={() => { setQuery(''); setSelected(null); }}><TableIcon name="close" /></button>}
        </div>
        <p className="catalog-count" role="status">{catalog.loading ? 'Buscando…' : <><strong>{catalog.tokens.length}{catalog.tokens.length >= catalogLimit ? '+' : ''}</strong> ficha{catalog.tokens.length === 1 ? '' : 's'}</>}</p>
      </div>
      {catalog.error && <p role="alert" className="error">{catalog.error}</p>}
      {!catalog.loading && !catalog.error && catalog.tokens.length === 0 && <p className="library-empty">Nenhuma ficha encontrada.</p>}
      {catalog.tokens.length > 0 && <ul className="token-grid">{catalog.tokens.map(item => {
        const stats = statsLabel(item.power, item.toughness);
        return <li key={item.name}>
          <button type="button" className="token-tile" aria-label={`Selecionar ${item.name}`} aria-pressed={selected?.name === item.name} disabled={busy || catalog.loading} onClick={() => setSelected(item)}>
            <TokenArt token={item} />
            {stats && <span className="token-stats-badge" aria-label={`Poder e resistência ${stats}`}>{stats}</span>}
            {selected?.name === item.name && <span className="token-selected-check" aria-hidden="true">✓</span>}
          </button>
          <strong className="token-name">{item.name}</strong>
        </li>;
      })}</ul>}
    </section>}
    {tab === 'custom' && <div className="creations-form" role="tabpanel" id="token-panel-custom" aria-labelledby="token-tab-custom">
      <div className="custom-token-preview" aria-label="Prévia da ficha"><span>Prévia</span><div className="custom-token-card"><strong>{token.name || "Nome da ficha"}</strong><div className="custom-token-art" /><small>Ficha</small><p tabIndex={0} aria-label="Descrição na prévia">{token.description}</p>{statsLabel(token.power, token.toughness) && <b>{statsLabel(token.power, token.toughness)}</b>}</div></div>
      <div className="custom-token-fields">
      <label className="form-field"><span className="form-label">Nome da ficha</span><input required maxLength={200} placeholder="Ex.: Espírito" value={token.name} onChange={event => setToken({ ...token, name: event.target.value })} /></label>
      <label className="form-field"><span className="form-label">Descrição<small>opcional</small></span><textarea aria-label="Descrição da ficha" maxLength={5000} value={token.description} onChange={event => setToken({ ...token, description: event.target.value })} /></label>
      <div className="form-field custom-token-stats" role="group" aria-labelledby="token-stats-label">
        <span className="form-label" id="token-stats-label">Poder / Resistência</span>
        <div className="token-stats"><div className="small-stepper">
          <button type="button" className="secondary" aria-label="Diminuir poder e resistência" disabled={!validPair} onClick={() => step(-1)}>−</button>
          <input aria-label="Poder/resistência da ficha" aria-invalid={!validPair} placeholder="X/Y" value={pair} onChange={event => updatePair(event.target.value)} />
          <button type="button" className="secondary" aria-label="Aumentar poder e resistência" disabled={!validPair} onClick={() => step(1)}>+</button>
        </div></div>
      </div>
      </div>
    </div>}
    {result && <PanelResult>{result}</PanelResult>}
    <GameActionFooter onCancel={onCancel} disabled={busy || (tab === 'catalog' ? !selected || catalog.loading || !!catalog.error : !token.name.trim() || !validPair)} hideDivider label="Criar ficha" onConfirm={() => {
      if (tab === 'catalog' && selected) void create(() => onCreateToken(selected.name), selected.name, statsLabel(selected.power, selected.toughness));
      else if (tab === 'custom' && token.name.trim() && validPair) void create(() => onCreateCustom(token), token.name.trim(), statsLabel(token.power, token.toughness));
    }} />
  </div>;
}

function TokenArt({ token }: { token: CatalogToken }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <span className="token-art token-art-fallback">{token.name}</span>
    : <img className="token-art" src={cardImageURL(token)} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
