import { useEffect, useMemo, useRef, useState } from 'react';
import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';

type Destination = 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command' | 'library:top' | 'library:bottom';
type Remainder = 'top' | 'bottom' | 'shuffle';
type Source = 'top' | 'bottom' | 'all';

type Props = {
  open: boolean;
  cards: Card[];
  revealed: Card[];
  busy: boolean;
  onConsult: (from: Source, count: number) => void;
  onReveal: (count: number) => void;
  onMove: (ids: string[], to: string, placement?: 'top' | 'bottom') => void;
  onReorder: (ids: string[]) => void;
  onClose: (placement: 'top' | 'bottom', shuffle: boolean) => void;
  onInspect: (card: Card) => void;
  onDismiss: () => void;
};

const destinations: { value: Destination; label: string }[] = [
  { value: 'hand', label: 'Mão' },
  { value: 'battlefield', label: 'Campo' },
  { value: 'graveyard', label: 'Cemitério' },
  { value: 'exile', label: 'Exílio' },
  { value: 'command', label: 'Comando' },
  { value: 'library:top', label: 'Em cima do grimório' },
  { value: 'library:bottom', label: 'Embaixo do grimório' },
];

export function LibraryConsultation({ open, cards, revealed, busy, onConsult, onReveal, onMove, onReorder, onClose, onInspect, onDismiss }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<'consultar' | 'revelar'>('consultar');
  const [source, setSource] = useState<Source>('top');
  const [count, setCount] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>('hand');
  const [remainder, setRemainder] = useState<Remainder>('shuffle');
  const [dragging, setDragging] = useState('');
  const revealing = mode === 'revelar';
  const quantityLocked = !revealing && source === 'all';
  const pool = revealing ? revealed : cards;
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);
  const filtered = useMemo(
    () => pool.filter(card => card.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),
    [pool, search],
  );
  const selectedCards = selected.filter(id => pool.some(card => card.id === id));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const send = () => {
    const ids = pool.filter(card => selectedCards.includes(card.id)).map(card => card.id);
    if (!ids.length) return;
    const [to, placement] = destination.split(':') as [string, 'top' | 'bottom' | undefined];
    onMove(ids, to, placement);
    setSelected([]);
  };
  const dropRow = (targetId: string) => {
    if (revealing || !dragging || dragging === targetId) return;
    const next = [...cards];
    const from = next.findIndex(card => card.id === dragging);
    const to = next.findIndex(card => card.id === targetId);
    if (from < 0 || to < 0) return;
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    onReorder(next.map(item => item.id));
    setDragging('');
  };
  const conclude = () => {
    if (revealing) return;
    if (cards.length === 0) {
      if (remainder === 'shuffle') onClose('top', true);
      return;
    }
    onClose(remainder === 'bottom' ? 'bottom' : 'top', remainder === 'shuffle');
  };
  if (!open) return null;
  return <div className="actions-panel library-consultation" role="dialog" aria-label="Consultar grimório">
    <header>
      <div><p className="actions-kicker">Grimório</p><h2>Consultar grimório</h2></div>
      <button ref={closeRef} type="button" className="secondary" aria-label="Fechar consulta do grimório" onClick={onDismiss}>×</button>
    </header>
    <div className="consult-modes" role="group" aria-label="Modo do grimório">
      <button type="button" aria-pressed={mode === 'consultar'} onClick={() => setMode('consultar')}>Consultar</button>
      <button type="button" aria-pressed={revealing} onClick={() => setMode('revelar')}>Revelar</button>
    </div>
    <div className="consult-command">
      <label>De onde
        <select aria-label="De onde" disabled={revealing} value={revealing ? 'next' : source} onChange={event => setSource(event.target.value as Source)}>
          {revealing
            ? <option value="next">Próximas do topo</option>
            : <>
              <option value="top">Topo</option>
              <option value="bottom">Fundo</option>
              <option value="all">Grimório inteiro</option>
            </>}
        </select>
      </label>
      <div className="consult-stepper">
        <span>Quantidade</span>
        <button type="button" className="secondary" aria-label="Diminuir quantidade" disabled={busy || quantityLocked || count <= 1} onClick={() => setCount(value => Math.max(1, value - 1))}>−</button>
        <input aria-label="Quantidade para consultar" inputMode="numeric" disabled={quantityLocked} value={quantityLocked ? '—' : count} onChange={event => setCount(Math.max(1, Number(event.target.value) || 1))} />
        <button type="button" className="secondary" aria-label="Aumentar quantidade" disabled={busy || quantityLocked} onClick={() => setCount(value => value + 1)}>+</button>
      </div>
      <button type="button" disabled={busy || (!revealing && cards.length > 0) || (revealing && cards.length > 0)} onClick={() => revealing ? onReveal(count) : onConsult(source, quantityLocked ? 1 : count)}>{revealing ? 'Revelar' : 'Ver as cartas'}</button>
    </div>
    <div className="consult-list-band">
      <div className="consult-list-tools">
        <input aria-label="Buscar no grimório" value={search} placeholder="Buscar por nome" onChange={event => setSearch(event.target.value)} />
        <button type="button" className="text-button" disabled={pool.length === 0} onClick={() => setSelected(selectedCards.length === pool.length ? [] : pool.map(card => card.id))}>Selecionar todas</button>
      </div>
      <div className="consult-cards">
        {filtered.length === 0 && <p className="consult-empty">{pool.length === 0 ? 'Nenhuma carta aberta.' : 'Nenhuma carta com esse nome.'}</p>}
        {filtered.map(card => <div key={card.id} className={`consult-row ${selectedCards.includes(card.id) ? 'selected' : ''}`} draggable={!revealing} onDragStart={() => setDragging(card.id)} onDragOver={event => event.preventDefault()} onDrop={() => dropRow(card.id)} onClick={() => toggle(card.id)}>
          <button type="button" className="consult-face" aria-label={`Imagem de ${card.name}`} onClick={event => { event.stopPropagation(); onInspect(card); }}><img src={deckApi.imageURL(card.name)} alt="" /></button>
          <span>{card.name}</span>
        </div>)}
      </div>
    </div>
    <div className="consult-footer">
      <label>Enviar para
        <select aria-label="Enviar para" value={destination} onChange={event => setDestination(event.target.value as Destination)}>
          {destinations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy || selectedCards.length === 0} onClick={send}>Enviar</button>
      <label>O que sobrou
        <select aria-label="O que sobrou" value={remainder} onChange={event => setRemainder(event.target.value as Remainder)}>
          <option value="top">Devolver em cima</option>
          <option value="bottom">Devolver embaixo</option>
          <option value="shuffle">Embaralhar</option>
        </select>
      </label>
      <button type="button" disabled={busy || revealing || (cards.length === 0 && remainder !== 'shuffle')} onClick={conclude}>Concluir</button>
    </div>
  </div>;
}
