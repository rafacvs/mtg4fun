import { useCallback, useEffect, useState } from 'react';
import type { Card } from './roomsApi';

export type LibrarySource = 'top' | 'bottom' | 'all';
export type LibraryOperations = {
  onConsult: (from: LibrarySource, count: number) => Promise<boolean>;
  onReveal: (count: number) => Promise<boolean>;
  onRevealSelection: (ids: string[]) => Promise<boolean>;
  onDraw: (count: number) => Promise<boolean>;
  onMove: (ids: string[], to: string, placement?: 'top' | 'bottom') => Promise<boolean>;
  onReorder: (ids: string[]) => Promise<boolean>;
  onClose: (placement: 'top' | 'bottom', shuffle: boolean) => Promise<boolean>;
};

function hasType(card: Card, type: string) {
  return type === 'unknown' ? !card.type : Boolean(card.type?.split('—')[0].trim().split(/\s+/).includes(type));
}

export function useLibraryConsultation(
  cards: Card[],
  operations: LibraryOperations,
  consultationFrom?: LibrarySource,
) {
  const [view, setView] = useState<'menu' | 'look' | 'reveal' | 'draw'>('menu');
  const [source, setSource] = useState<'top' | 'bottom'>('top');
  const [count, setCount] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [placement, setPlacement] = useState<'top' | 'bottom'>(
    consultationFrom === 'bottom' ? 'bottom' : 'top',
  );
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setPlacement(consultationFrom === 'bottom' ? 'bottom' : 'top');
    setSelected([]);
    setSearch('');
    setTypeFilter('');
  }, [consultationFrom]);
  const named = cards.filter((card) => card.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const filtered = named.filter((card) => !typeFilter || hasType(card, typeFilter));
  const countType = (type: string) => named.filter((card) => hasType(card, type)).length;
  const selectedIDs = cards.filter((card) => selected.includes(card.id)).map((card) => card.id);
  const choose = (next: typeof view) => {
    setView(next);
    setNotice('');
    setSearch('');
    setTypeFilter('');
    setSelected([]);
  };
  const resetScreen = useCallback(() => { setView('menu'); setNotice(''); }, []);
  const begin = async () => {
    const succeeded =
      view === 'draw'
        ? await operations.onDraw(count)
        : view === 'reveal'
          ? await operations.onReveal(count)
          : await operations.onConsult(source, count);
    if (succeeded) {
      setPlacement(view === 'look' ? source : 'top');
      setView('menu');
      setSearch('');
      setTypeFilter('');
      setSelected([]);
      setNotice(view === 'draw' ? `${count} carta(s) comprada(s).` : '');
    }
  };
  const searchLibrary = async () => {
    if (await operations.onConsult('all', 1)) {
      choose('menu');
      setPlacement('top');
    }
  };
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  const selectResults = () => {
    const ids = filtered.map((card) => card.id);
    setSelected((current) =>
      ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  };
  const move = async (to: string, target?: 'top' | 'bottom') => {
    if (!selectedIDs.length || !(await operations.onMove(selectedIDs, to, target))) return false;
    setSelected([]);
    return true;
  };
  // Remaining search cards return above anything already moved to the library, so
  // the search places its top and bottom through the order it will close with.
  const sendToLibrary = async (target: 'top' | 'bottom', consultedIDs: string[]) => {
    const chosen = consultedIDs.filter((id) => selectedIDs.includes(id));
    const others = consultedIDs.filter((id) => !selectedIDs.includes(id));
    const succeeded = await operations.onReorder(target === 'top' ? [...chosen, ...others] : [...others, ...chosen]);
    if (succeeded) setSelected([]);
    return succeeded;
  };
  const clearSelection = () => setSelected([]);
  const reveal = async () => {
    if (selectedIDs.length && (await operations.onRevealSelection(selectedIDs))) setSelected([]);
  };
  const reorder = async (id: string, targetID: string) => {
    const from = cards.findIndex((card) => card.id === id);
    const to = cards.findIndex((card) => card.id === targetID);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...cards];
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    await operations.onReorder(next.map((card) => card.id));
  };
  const finish = async (shuffle = false) => {
    if (await operations.onClose(placement, shuffle)) {
      choose('menu');
      setNotice(shuffle ? 'Grimório embaralhado.' : 'Cartas devolvidas ao grimório.');
      return true;
    }
    return false;
  };
  return {
    view,
    choose,
    resetScreen,
    source,
    setSource,
    count,
    setCount,
    typeFilter,
    setTypeFilter,
    search,
    setSearch,
    placement,
    setPlacement,
    notice,
    filtered,
    countType,
    namedCount: named.length,
    selectedIDs,
    clearSelection,
    sendToLibrary,
    toggle,
    selectResults,
    begin,
    searchLibrary,
    move,
    reveal,
    reorder,
    finish,
  };
}
