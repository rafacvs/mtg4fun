import { useRef, useState } from 'react';
import type { Card } from './roomsApi';
import type { CardGesture } from './PlayerTable';
import { PlayingCard } from './PlayingCard';
import { TablePanel } from './TablePanel';
import { TableIcon } from './TableIcon';
import { types, TypeChip } from './LibrarySearchSheet';
import { hasType } from './useLibraryConsultation';
import { cardImageURL } from './cardImage';
import './library-search.css';
import './public-zone-viewer.css';

export function PublicZoneViewer({ title, playerName, cards, anchor, viewerId, disabled, gesture, onInspect, onReorder, onMove, onClose }: {
  title: string;
  playerName: string;
  cards: Card[];
  anchor: HTMLElement | null;
  viewerId: number;
  disabled: boolean;
  gesture: CardGesture;
  onInspect: (card: Card) => void;
  onReorder?: (ids: string[]) => Promise<boolean>;
  onMove?: (ids: string[], to: string, placement?: 'top' | 'bottom') => Promise<boolean>;
  onClose: () => void;
}) {
  // Shown from the top down; the zone stores its top as the last card.
  const shown = [...cards].reverse();
  const list = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState('');
  const [target, setTarget] = useState('');
  const [search, setSearch] = useState('');
  const [compact, setCompact] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState('hand');
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const named = shown.filter(card => card.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim()));
  const filtered = named.filter(card => !typeFilter || hasType(card, typeFilter));
  const chosen = shown.filter(card => selected.includes(card.id) && card.controllerId === viewerId);
  const ordered = ['library', 'graveyard', 'exile'].includes(destination);
  const zones = [
    { id: 'hand', label: 'Mão', icon: 'cards' }, { id: 'battlefield', label: 'Campo', icon: 'type-land' },
    { id: 'graveyard', label: 'Cemitério', icon: 'rail-graveyard' }, { id: 'exile', label: 'Exílio', icon: 'coin' },
    { id: 'library', label: 'Grimório', icon: 'rail-library' },
  ] as const;
  const stopMoving = () => { setMoving(''); setTarget(''); };
  const reorder = (id: string, targetID: string) => {
    const from = shown.findIndex(card => card.id === id);
    const to = shown.findIndex(card => card.id === targetID);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...shown];
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    void onReorder?.(next.reverse().map(item => item.id));
  };
  const cardAt = (card: Card, x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-zone-card-id]');
    const id = element && list.current?.contains(element) ? element.dataset.zoneCardId ?? '' : '';
    return id === card.id ? '' : id;
  };
  // Dropped on another card it changes the order; anywhere else it stays a normal card drag.
  const cardGesture: CardGesture = !onReorder ? gesture : {
    ...gesture,
    onDragMove: (card, x, y) => {
      setMoving(card.id);
      setTarget(cardAt(card, x, y));
      const box = list.current?.getBoundingClientRect();
      if (box && list.current && x >= box.left && x <= box.right) list.current.scrollTop += y < box.top + 28 && y >= box.top - 28 ? -8 : y > box.bottom - 28 && y <= box.bottom + 28 ? 8 : 0;
      gesture.onDragMove(card, x, y);
    },
    onDragEnd: (card, x, y) => {
      const dropped = cardAt(card, x, y);
      stopMoving();
      if (dropped) { gesture.onDragCancel(); reorder(card.id, dropped); }
      else gesture.onDragEnd(card, x, y);
    },
    onDragCancel: () => { stopMoving(); gesture.onDragCancel(); },
  };
  return <TablePanel open anchor={anchor} wide dismissOutside={!compact} label={`${title} de ${playerName}`} className={`public-zone-viewer library-search-sheet ${compact ? 'public-zone-compact' : ''}`} onClose={onClose}>
    {(['tl', 'tr', 'bl', 'br'] as const).map(corner => <i key={corner} className={`search-corner search-corner-${corner}`} aria-hidden="true" />)}
    <header className="search-header public-zone-header table-panel-header">
      <div className="public-zone-pile" aria-hidden="true"><TableIcon name={title === 'Cemitério' ? 'rail-graveyard' : 'rail-exile'} /><b>{cards.length}</b></div>
      <div className="search-title"><h2>{title} de {playerName}</h2><p><TableIcon name="eye" />Zona pública · {cards.length === 1 ? '1 carta' : `${cards.length} cartas`}</p></div>
      <div className="public-zone-window-actions">
        <button type="button" aria-label={compact ? 'Expandir painel' : 'Diminuir painel'} title={compact ? 'Expandir' : 'Diminuir'} onClick={() => setCompact(!compact)}><TableIcon name={compact ? 'focus' : 'window-minimize'} /></button>
        <button type="button" data-panel-close aria-label={`Fechar ${title.toLocaleLowerCase('pt-BR')}`} title="Fechar" onClick={onClose}><TableIcon name="close" /></button>
      </div>
    </header>
    <div className="search-tools"><div className="search-tools-row">
      <div className={`search-field ${search ? 'filled' : ''}`}><TableIcon name="search" /><input aria-label={`Buscar no ${title.toLocaleLowerCase('pt-BR')}`} placeholder="Buscar por nome" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}><TableIcon name="close" /></button>}</div>
      <span className="search-total"><b>{filtered.length}</b> de {cards.length} cartas</span>
      {onMove && <button type="button" className="search-select-all" disabled={disabled || !filtered.length} onClick={() => { const ids = filtered.filter(card => card.controllerId === viewerId).map(card => card.id); setSelected(current => ids.every(id => current.includes(id)) ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]); }}><TableIcon name="check-square" />Selecionar todas</button>}
    </div><div className="search-chips" role="group" aria-label="Filtrar por tipo">
      <TypeChip label="Todos" icon="cards" count={named.length} active={!typeFilter} onClick={() => setTypeFilter('')} />
      {types.map(type => { const count = named.filter(card => hasType(card, type.id)).length; return type.optional && !count ? null : <TypeChip key={type.id} label={type.label} icon={type.icon} count={count} active={typeFilter === type.id} onClick={() => setTypeFilter(type.id)} />; })}
    </div></div>
    <div ref={list} className="public-zone-cards search-cards" aria-label={`Cartas no ${title.toLocaleLowerCase('pt-BR')}`}>
      {!filtered.length && <p className="library-empty">{cards.length ? 'Nenhuma carta com esses filtros.' : 'Nenhuma carta nesta zona.'}</p>}
      {filtered.map(card => { const index = shown.indexOf(card); return <article
        key={card.id}
        data-zone-card-id={card.id}
        className={`public-zone-card search-card ${selected.includes(card.id) ? 'selected' : ''} ${moving === card.id ? 'dragging' : ''} ${target === card.id ? 'drag-target' : ''}`}
        onKeyDown={event => {
          const offset = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
          const neighbour = shown[index + offset];
          if (!onReorder || !offset || disabled) return;
          event.preventDefault();
          if (neighbour) reorder(card.id, neighbour.id);
        }}
      >
        <div className="search-card-frame"><PlayingCard {...cardGesture} card={card} draggable={!disabled && card.controllerId === viewerId} ariaLabel={`${onMove ? 'Selecionar' : 'Ver imagem de'} ${card.name}`} onOpenMenu={() => onInspect(card)} onInspect={() => { if (!onMove || card.controllerId !== viewerId) onInspect(card); else if (!disabled) setSelected(current => current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id]); }} /><b className="search-card-rank">{index + 1}</b>{selected.includes(card.id) && <span className="search-card-check" aria-hidden="true">✓</span>}</div>
        <strong>{card.name}</strong><small>{index === 0 ? 'Topo' : card.type ?? ''}</small>
      </article>; })}
    </div>
    {onMove && <section className={`search-step-one ${chosen.length ? 'has-choice' : ''}`} role="region" aria-label="Ações da seleção">
      <h3 className="search-step-label"><i>1</i><span>Cartas<br />escolhidas</span></h3>
      <div className="search-choice">{chosen.length ? <><div className="search-thumbs" aria-hidden="true">{chosen.slice(0, 3).map(card => <img key={card.id} src={cardImageURL(card)} alt="" />)}</div><div><strong>{chosen.length} {chosen.length === 1 ? 'selecionada' : 'selecionadas'}</strong><button className="search-clear" type="button" onClick={() => setSelected([])}>limpar seleção</button></div></> : <><span className="search-choice-empty"><TableIcon name="card-pick" /></span><div><strong>Nenhuma ainda</strong><small>Clique nas cartas acima para escolher</small></div></>}</div>
      <div className="search-destination"><span className="search-control-label">Para onde</span><div className="search-zones" role="group" aria-label="Para onde">{zones.map(zone => <button key={zone.id} type="button" aria-pressed={destination === zone.id} disabled={!chosen.length || disabled || zone.label === title} onClick={() => setDestination(zone.id)}><TableIcon name={zone.icon} />{zone.label}</button>)}</div></div>
      <div className={`search-position ${ordered && chosen.length ? '' : 'inactive'}`}><span className="search-control-label">{ordered ? 'Posição' : 'Posição · não se aplica'}</span><div role="group" aria-label="Posição">{(['top', 'bottom'] as const).map(side => <button key={side} type="button" aria-pressed={ordered && placement === side} disabled={!ordered || !chosen.length || disabled} onClick={() => setPlacement(side)}><TableIcon name={side === 'top' ? 'arrow-up' : 'arrow-down'} />{side === 'top' ? 'Topo' : 'Fundo'}</button>)}</div></div>
      <button type="button" className="search-send" disabled={!chosen.length || disabled || zones.find(zone => zone.id === destination)?.label === title} onClick={() => void onMove(chosen.map(card => card.id), destination, ordered ? placement : undefined).then(ok => { if (ok) setSelected([]); })}><strong>{chosen.length ? `Enviar ${chosen.length} ${chosen.length === 1 ? 'carta' : 'cartas'}` : 'Enviar as cartas'}</strong><small>para {zones.find(zone => zone.id === destination)?.label.toLocaleLowerCase('pt-BR')}</small></button>
    </section>}
    <footer className="public-zone-footer"><span>{onReorder ? 'Arraste as cartas para reordenar ou movê-las para outra zona.' : 'Cartas visíveis para todos.'}</span><button type="button" onClick={onClose}>Fechar {title.toLocaleLowerCase('pt-BR')}</button></footer>
  </TablePanel>;
}
