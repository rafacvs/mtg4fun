import { useMemo, useState } from 'react';
import type { Card } from './roomsApi';

type Props = {
  cards: Card[];
  busy: boolean;
  onConsult: (from: 'all' | 'top' | 'bottom', count: number) => void;
  onMove: (ids: string[], to: string, placement?: 'top' | 'bottom') => void;
  onReorder: (ids: string[]) => void;
  onClose: (placement: 'top' | 'bottom', shuffle: boolean) => void;
};

export function LibraryConsultation({ cards, busy, onConsult, onMove, onReorder, onClose }: Props) {
  const [count, setCount] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = useMemo(
    () => cards.filter(card => card.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),
    [cards, search],
  );
  const selectedCards = selected.filter(id => cards.some(card => card.id === id));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const move = (to: string, placement?: 'top' | 'bottom') => {
    if (!selectedCards.length) return;
    onMove(selectedCards, to, placement);
    setSelected([]);
  };
  const reorder = (direction: -1 | 1) => {
    if (selectedCards.length !== 1) return;
    const index = cards.findIndex(card => card.id === selectedCards[0]);
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map(card => card.id));
  };
  return <section className="library-consultation" aria-label="Consultar grimório">
    <h2>Consultar grimório</h2>
    {cards.length === 0 ? <div className="consult-controls">
      <button type="button" disabled={busy} onClick={() => onConsult('all', 1)}>
        Consultar todo o grimório
      </button>
      <label>
        Quantidade
        <input aria-label="Quantidade para consultar" type="number" min="1" value={count} onChange={event => setCount(Math.max(1, Number(event.target.value)))} />
      </label>
      <button type="button" disabled={busy} onClick={() => onConsult('top', count)}>Ver topo</button>
      <button type="button" disabled={busy} onClick={() => onConsult('bottom', count)}>Ver fundo</button>
      <button type="button" disabled={busy} onClick={() => onClose('top', true)}>Embaralhar grimório</button>
    </div> : <>
      <label>
        Buscar por nome
        <input aria-label="Buscar no grimório" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      <p>{cards.length} carta(s) em consulta privada. A busca e a ordem não são compartilhadas.</p>
      <div className="consult-cards">
        {filtered.map(card => <label key={card.id}>
          <input type="checkbox" checked={selectedCards.includes(card.id)} onChange={() => toggle(card.id)} />
          {card.name}
        </label>)}
      </div>
      <div className="consult-controls">
        <button type="button" disabled={busy || selectedCards.length !== 1} onClick={() => reorder(-1)}>Subir</button>
        <button type="button" disabled={busy || selectedCards.length !== 1} onClick={() => reorder(1)}>Descer</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('hand')}>Enviar à mão</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('battlefield')}>Enviar ao campo</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('graveyard')}>Enviar ao cemitério</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('exile')}>Enviar ao exílio</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('command')}>Mover comandante para comando</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('library', 'top')}>Enviar ao topo</button>
        <button type="button" disabled={busy || !selectedCards.length} onClick={() => move('library', 'bottom')}>Enviar ao fundo</button>
        <button type="button" disabled={busy} onClick={() => onClose('top', false)}>Fechar no topo</button>
        <button type="button" disabled={busy} onClick={() => onClose('bottom', false)}>Fechar no fundo</button>
        <button type="button" disabled={busy} onClick={() => onClose('top', true)}>Fechar e embaralhar</button>
      </div>
    </>}
  </section>;
}
