import { useEffect, useMemo, useState } from 'react';
import { deckApi, type CatalogCard, type Deck } from './deckApi';
import type { useDecks } from './useDecks';
import { useModalDialog } from './useModalDialog';
import { useDeckCatalogSearch } from './useDeckCatalogSearch';
import './decks.css';

type Props = { deck: Deck | undefined; open: boolean; library: ReturnType<typeof useDecks>; onClose: () => void };
const types = [['Creature', 'Criatura'], ['Land', 'Terreno'], ['Artifact', 'Artefato'], ['Enchantment', 'Encantamento'], ['Instant', 'Instantânea'], ['Sorcery', 'Feitiço'], ['Planeswalker', 'Planeswalker'], ['Battle', 'Batalha']];
const colors = [['W', 'Branco'], ['U', 'Azul'], ['B', 'Preto'], ['R', 'Vermelho'], ['G', 'Verde'], ['M', 'Multicor'], ['C', 'Incolor']];

export function DeckEditorDialog({ deck, open, library, onClose }: Props) {
  const dialog = useModalDialog(open);
  const [name, setName] = useState('');
  const [commander, setCommander] = useState('');
  const [cards, setCards] = useState<Deck['cards']>([]);
  const [initial, setInitial] = useState('');
  const [query, setQuery] = useState('');
  const [deckQuery, setDeckQuery] = useState('');
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const [cmc, setCmc] = useState('');
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<'deck' | 'catalog'>('deck');
  const search = useDeckCatalogSearch(open, { q: query, type, color, cmc }, offset);
  const [preview, setPreview] = useState<CatalogCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !deck) return;
    const current = { name: deck.name, commander: deck.commander ?? '', cards: deck.cards.map(({ name, quantity }) => ({ name, quantity })) };
    setName(current.name); setCommander(current.commander); setCards(deck.cards.map(card => ({ ...card })));
    setInitial(JSON.stringify(current)); setPreview(null); setReplacing(null); setQuantityDraft({}); setTab('deck'); setDeckQuery(''); setOffset(0); setQuery(''); setType(''); setColor(''); setCmc('');
  }, [open, deck?.id]);
  const snapshot = JSON.stringify({ name, commander, cards: cards.map(({ name, quantity }) => ({ name, quantity })) });
  const dirty = snapshot !== initial;
  const count = cards.reduce((sum, card) => sum + card.quantity, 0);
  const pending = cards.filter(card => !card.available);
  const curve = useMemo(() => {
    const counts = new Map<number, number>();
    cards.filter(card => card.available).forEach(card => counts.set(card.cmc, (counts.get(card.cmc) ?? 0) + card.quantity));
    return [...counts].sort(([a], [b]) => a - b);
  }, [cards]);
  function close() { if (!dirty || window.confirm('Há alterações não salvas. Fechar e descartá-las?')) onClose(); }
  function add(card: CatalogCard) {
    if (replacing) {
      const old = cards.find(item => item.name === replacing);
      if (old) {
        setCards(current => {
          const rest = current.filter(item => item.name !== replacing);
          const exists = rest.find(item => item.name === card.name);
          return exists ? rest.map(item => item.name === card.name ? { ...item, quantity: item.quantity + old.quantity } : item) : [...rest, { ...card, quantity: old.quantity, available: true }];
        });
        if (commander === replacing) setCommander(card.name);
      }
      setReplacing(null); setPreview(card); setTab('deck'); return;
    }
    setCards(current => current.some(item => item.name === card.name) ? current.map(item => item.name === card.name ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...card, quantity: 1, available: true }]);
    setPreview(card);
  }
  function setQuantity(cardName: string, quantity: number) {
    setQuantityDraft(current => { const next = { ...current }; delete next[cardName]; return next; });
    if (quantity <= 0) {
      setCards(current => current.filter(card => card.name !== cardName));
      setQuantityDraft(current => { const next = { ...current }; delete next[cardName]; return next; });
      if (commander === cardName) setCommander('');
    } else setCards(current => current.map(card => card.name === cardName ? { ...card, quantity } : card));
  }
  async function save() {
    if (!deck || !dirty || saving) return;
    setSaving(true);
    const saved = await library.update(deck.id, name, commander, cards.map(({ name, quantity }) => ({ name, quantity })));
    setSaving(false);
    if (saved) { setInitial(JSON.stringify({ name: saved.name, commander: saved.commander ?? '', cards: saved.cards.map(({ name, quantity }) => ({ name, quantity })) })); onClose(); }
  }
  function replace(cardName: string) { setReplacing(cardName); setQuery(''); setType(''); setColor(''); setCmc(''); setOffset(0); setTab('catalog'); }
  const filterCount = [type, color, cmc].filter(Boolean).length;
  return <dialog ref={dialog} className="deck-editor-dialog deck-editor-modal" aria-label={deck ? `Editar ${deck.name}` : 'Editar deck'} onCancel={event => { event.preventDefault(); close(); }} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    {open && deck && <>
      <header className="deck-editor-heading"><div><p className="eyebrow">SUA OFICINA</p><h2>Editar deck</h2><p>Monte sua próxima partida</p></div><button type="button" className="secondary editor-close" aria-label="Fechar editor" onClick={close}>×</button></header>
      {library.error && <p role="alert" className="error">{library.error}</p>}
      <div className="deck-editor-fields"><label>Nome do deck<input aria-label="Nome do deck" maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label><div className="deck-editor-stats"><strong>{count} cartas</strong><span>{cards.length} nomes</span><span>Identidade · {commander ? cards.find(card => card.name === commander)?.colorIdentity || 'incolor' : 'não definida'}</span></div></div>
      {pending.length > 0 && <div className="editor-pending" role="status"><div><strong>{pending.length} {pending.length === 1 ? 'carta precisa' : 'cartas precisam'} de atenção</strong><span>{pending.map(card => `${card.quantity}× ${card.name}`).join(' · ')} — {pending.length === 1 ? 'nome não encontrado' : 'nomes não encontrados'} no catálogo.</span></div><button type="button" onClick={() => { setDeckQuery(''); setTab('deck'); window.setTimeout(() => document.getElementById('editor-pending-cards')?.scrollIntoView({ block: 'nearest' }), 0); }}>Ir às pendências</button></div>}
      <div className="editor-tabs" role="group" aria-label="Área do editor"><button type="button" aria-pressed={tab === 'deck'} onClick={() => setTab('deck')}>Meu deck <b>{count}</b></button><button type="button" aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>Buscar cartas</button></div>
      <div className="deck-editor-layout">
        <section className={`deck-editor-list ${tab !== 'deck' ? 'editor-mobile-hidden' : ''}`} aria-label="Cartas do deck"><div className="editor-section-title"><div><p className="eyebrow">SUA COLEÇÃO</p><h3>Cartas do deck</h3></div><span>{count} cartas</span></div>
          {cards.length > 0 && <label className="editor-deck-search"><span className="sr-only">Buscar no deck</span><input aria-label="Buscar no deck" placeholder="Buscar no deck" value={deckQuery} onChange={event => setDeckQuery(event.target.value)} /></label>}
          {cards.length === 0 ? <div className="editor-empty"><strong>Seu deck começa aqui</strong><p>Encontre cartas no catálogo e monte sua lista.</p><button type="button" onClick={() => setTab('catalog')}>Buscar cartas</button></div> : <ul>{cards.filter(card => `${card.name} ${card.text}`.toLowerCase().includes(deckQuery.toLowerCase())).map(card => <li key={card.name} id={!card.available && pending[0]?.name === card.name ? 'editor-pending-cards' : undefined} className={!card.available ? 'pending-card' : ''}>
            <button className="editor-card-name" type="button" onClick={() => setPreview(card)}>{card.available ? <img src={deckApi.imageURL(card.name)} alt="" loading="lazy" decoding="async" /> : <span className="editor-missing-art">?</span>}<span><b>{card.name}</b><small>{!card.available ? 'Nome não encontrado no catálogo' : commander === card.name ? 'Comandante' : `${card.type || card.mainType || 'Carta'} · ${card.cmc} mana`}</small></span></button>
            <div className="editor-card-controls"><button type="button" aria-label={`Diminuir ${card.name}`} onClick={() => setQuantity(card.name, card.quantity - 1)}>−</button><input type="number" min={1} max={100000} aria-label={`Quantidade de ${card.name}`} value={quantityDraft[card.name] ?? String(card.quantity)} onChange={event => setQuantityDraft(current => ({ ...current, [card.name]: event.target.value }))} onBlur={() => { const value = Number(quantityDraft[card.name]); if (Number.isInteger(value) && value >= 1 && value <= 100000) setQuantity(card.name, value); else setQuantityDraft(current => { const next = { ...current }; delete next[card.name]; return next; }); }} /><button type="button" aria-label={`Aumentar ${card.name}`} onClick={() => setQuantity(card.name, card.quantity + 1)}>+</button></div>
            <div className="editor-card-actions"><button type="button" onClick={() => replace(card.name)}>{card.available ? 'Trocar' : 'Corrigir'}</button><button type="button" onClick={() => setQuantity(card.name, 0)}>Remover</button>{card.available && <button type="button" onClick={() => setCommander(commander === card.name ? '' : card.name)}>{commander === card.name ? 'Remover comandante' : 'Comandante'}</button>}</div>
          </li>)}</ul>}
          <details className="editor-analysis"><summary>Contagem e curva de mana</summary><div className="editor-curve" aria-label="Curva de mana">{curve.length ? curve.map(([mana, amount]) => <div key={mana} title={`${amount} cartas com valor ${mana}`}><i style={{ height: `${Math.max(8, Math.min(100, (amount / Math.max(...curve.map(([, number]) => number))) * 100))}%` }} /><small>{mana}</small><b>{amount}</b></div>) : <span>Sem dados para a curva.</span>}</div></details>
        </section>
        <section className={`deck-editor-search ${tab !== 'catalog' ? 'editor-mobile-hidden' : ''}`} aria-label="Catálogo de cartas"><div className="editor-section-title"><div><p className="eyebrow">CATÁLOGO COMPARTILHADO</p><h3>Encontre cartas</h3></div><span>{search.loading ? 'Buscando…' : `${search.total} resultados`}</span></div>
          {replacing && <p role="status" className="replace-pending-hint">Trocando <b>{replacing}</b> · quantidade mantida. Escolha uma carta abaixo. <button type="button" className="text-button" onClick={() => setReplacing(null)}>Cancelar troca</button></p>}
          <label className="editor-search-label"><span className="sr-only">Buscar por nome ou texto</span><input aria-label="Buscar catálogo" placeholder="Buscar por nome ou texto" value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} /></label>
          <details className="editor-filters"><summary>Filtros {filterCount > 0 && <b>{filterCount}</b>}</summary><div className="editor-filter-block"><span>Tipo</span><div className="editor-chips" role="group" aria-label="Filtrar catálogo por tipo"><button type="button" aria-pressed={!type} onClick={() => { setType(''); setOffset(0); }}>Todos</button>{types.map(([value, label]) => <button key={value} type="button" aria-pressed={type === value} onClick={() => { setType(type === value ? '' : value); setOffset(0); }}>{label}</button>)}</div></div><div className="editor-filter-block"><span>Identidade de cor</span><div className="editor-chips" role="group" aria-label="Filtrar catálogo por cor">{colors.map(([value, label]) => <button key={value} type="button" aria-pressed={color === value} onClick={() => { setColor(color === value ? '' : value); setOffset(0); }}>{label}</button>)}</div></div><label>Valor de mana<select aria-label="Filtrar catálogo por valor de mana" value={cmc} onChange={event => { setCmc(event.target.value); setOffset(0); }}><option value="">Qualquer valor</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{index}</option>)}<option value="12+">12+</option></select></label></details>
          {search.error && <p role="alert" className="error">{search.error}</p>}
          {search.loading && !search.error && <p className="editor-search-status" role="status">Buscando cartas…</p>}
          {!search.loading && !search.error && !search.cards.length && <p className="editor-search-status">Nenhuma carta encontrada. Tente outra busca ou filtro.</p>}
          <ul className="editor-results">{search.cards.map(card => <li key={card.name}><button type="button" className="editor-result" onClick={() => add(card)} onFocus={() => setPreview(card)}><span className="editor-result-art"><span aria-hidden="true">✧<small>MTG4FUN</small></span><img src={deckApi.imageURL(card.name)} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} /></span><strong>{card.name}</strong><small>{card.type || 'Carta'}</small><b>{replacing ? 'Trocar por esta' : '+ Adicionar'}</b></button><button type="button" className="editor-preview-link" onClick={() => setPreview(card)}>Prévia</button></li>)}</ul>
          <div className="editor-pagination"><button type="button" disabled={offset === 0 || search.loading} onClick={() => setOffset(Math.max(0, offset - 50))}>← Anterior</button><span>{search.loading ? 'Buscando…' : search.total ? `${search.offset + 1}–${search.offset + search.cards.length} de ${search.total}` : 'Nenhum resultado'}</span><button type="button" disabled={!search.hasMore || search.loading} onClick={() => setOffset(offset + 50)}>Próxima →</button></div>
        </section>
      </div>
      {preview && <aside className="deck-editor-preview" aria-label="Prévia da carta selecionada"><div><p className="eyebrow">PRÉVIA</p><h3>{preview.name}</h3><p>{preview.type || preview.mainType} · CMC {preview.cmc} · {preview.colorIdentity || 'Incolor'}</p><p className="card-text">{preview.text || 'O catálogo não informa texto para esta carta.'}</p></div><img key={preview.name} src={deckApi.imageURL(preview.name)} alt={`Imagem de ${preview.name}`} loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} /></aside>}
      <footer className="deck-editor-footer"><span role="status">{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span><button type="button" className="secondary" onClick={close}>Cancelar</button><button type="button" disabled={!dirty || saving || !name.trim()} onClick={() => void save()}>{saving || library.busy ? 'Salvando…' : 'Salvar deck'}</button></footer>
    </>}
  </dialog>;
}
