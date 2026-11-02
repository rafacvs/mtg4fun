import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Emoji = { unicode: string; label: string; tags?: string[]; group?: number };

// Nomes próprios: a tradução do pacote chama as bandeiras de “comutadores”.
const groups = [
  { id: 0, icon: '😀', name: 'Carinhas e emoção' },
  { id: 1, icon: '👋', name: 'Pessoas e corpo' },
  { id: 3, icon: '🐻', name: 'Animais e natureza' },
  { id: 4, icon: '🍔', name: 'Comida e bebida' },
  { id: 5, icon: '✈️', name: 'Viagens e lugares' },
  { id: 6, icon: '⚽', name: 'Atividades' },
  { id: 7, icon: '💡', name: 'Objetos' },
  { id: 8, icon: '💯', name: 'Símbolos' },
  { id: 9, icon: '🏁', name: 'Bandeiras' },
];

let catalog: Promise<Emoji[]> | null = null;
// A lista completa (cerca de 1.900 emojis com nomes em português) só baixa quando alguém abre o seletor.
function loadCatalog() {
  catalog ??= import('emojibase-data/pt/compact.json').then(module => (module.default as Emoji[]).filter(emoji => emoji.group !== undefined && emoji.group !== 2));
  return catalog;
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');

export function EmojiPicker({ anchor, panel, disabled, onPick, onClose }: {
  anchor: RefObject<HTMLElement | null>; panel: RefObject<HTMLDivElement | null>; disabled: boolean;
  onPick: (emoji: string) => void; onClose: () => void;
}) {
  const [emojis, setEmojis] = useState<Emoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const search = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadCatalog().then(list => { if (active) setEmojis(list); }, () => { if (active) setFailed(true); });
    search.current?.focus();
    return () => { active = false; };
  }, []);

  // Abre acima do botão quando cabe; senão abaixo. Fica sempre dentro da tela.
  useLayoutEffect(() => {
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(352, window.innerWidth - 16);
      const above = box.top - 16;
      const below = window.innerHeight - box.bottom - 16;
      const height = Math.min(400, Math.max(above, below));
      const left = Math.min(Math.max(8, box.right - width), window.innerWidth - width - 8);
      setPosition(above >= below ? { left, width, height, bottom: window.innerHeight - box.top + 8 } : { left, width, height, top: box.bottom + 8 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [onClose]);

  const found = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!emojis || !words.length) return null;
    return emojis.filter(emoji => {
      const text = normalize([emoji.label, ...emoji.tags ?? []].join(' '));
      return words.every(word => text.includes(word));
    });
  }, [emojis, query]);

  const button = (emoji: Emoji) => <button type="button" key={emoji.unicode} className="emoji-option" title={emoji.label} aria-label={`Enviar ${emoji.unicode} ${emoji.label}`} disabled={disabled} onClick={() => onPick(emoji.unicode)}>{emoji.unicode}</button>;

  return createPortal(<div ref={panel} className="emoji-picker" role="dialog" aria-label="Todos os emojis" style={position}>
    <input ref={search} type="search" className="emoji-search" placeholder="Pesquisar emoji" aria-label="Pesquisar emoji" value={query} onChange={event => setQuery(event.target.value)} />
    {!query && <nav className="emoji-groups" aria-label="Categorias">
      {groups.map(group => <button type="button" key={group.id} title={group.name} aria-label={group.name} onClick={() => grid.current?.querySelector(`[data-group="${group.id}"]`)?.scrollIntoView({ block: 'start' })}>{group.icon}</button>)}
    </nav>}
    <div ref={grid} className="emoji-catalog">
      {failed && <p role="alert" className="emoji-picker-note">Não foi possível carregar os emojis.</p>}
      {!emojis && !failed && <p role="status" className="emoji-picker-note">Carregando emojis…</p>}
      {found && (found.length ? <div className="emoji-grid" role="group" aria-label="Resultados">{found.map(button)}</div> : <p className="emoji-picker-note">Nenhum emoji para “{query}”.</p>)}
      {emojis && !found && groups.map(group => <section key={group.id} data-group={group.id} aria-label={group.name}>
        <h3>{group.name}</h3>
        <div className="emoji-grid">{emojis.filter(emoji => emoji.group === group.id).map(button)}</div>
      </section>)}
    </div>
  </div>, document.body);
}
