import { useEffect, useRef, useState } from 'react';
import { cardImageURL } from './cardImage';
import { LibraryCardBack } from './LibraryCardBack';
import { LibrarySearchCards } from './LibrarySearchCards';
import { PanelFeedback, type PanelFeedbackProps } from './TablePanel';
import { TableIcon, type TableIconName } from './TableIcon';
import type { Card } from './roomsApi';
import type { useLibraryConsultation } from './useLibraryConsultation';
import './library-search.css';

type Zone = 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'library';
type Side = 'top' | 'bottom';

const zones: { id: Zone; label: string; icon: TableIconName; destination: string; ordered: boolean }[] = [
  { id: 'hand', label: 'Mão', icon: 'cards', destination: 'para a mão', ordered: false },
  { id: 'battlefield', label: 'Campo', icon: 'type-land', destination: 'para o campo', ordered: false },
  { id: 'graveyard', label: 'Cemitério', icon: 'rail-graveyard', destination: 'do cemitério', ordered: true },
  { id: 'exile', label: 'Exílio', icon: 'coin', destination: 'do exílio', ordered: true },
  { id: 'library', label: 'Grimório', icon: 'rail-library', destination: 'do grimório', ordered: true },
];

const types: { id: string; label: string; icon: TableIconName; optional?: boolean }[] = [
  { id: 'Creature', label: 'Criaturas', icon: 'type-creature' },
  { id: 'Land', label: 'Terrenos', icon: 'type-land' },
  { id: 'Artifact', label: 'Artefatos', icon: 'sun' },
  { id: 'Enchantment', label: 'Encantamentos', icon: 'type-enchantment' },
  { id: 'Instant', label: 'Instantâneas', icon: 'bolt' },
  { id: 'Sorcery', label: 'Feitiços', icon: 'type-sorcery' },
  { id: 'Planeswalker', label: 'Planeswalkers', icon: 'type-planeswalker' },
  { id: 'Battle', label: 'Batalhas', icon: 'exile', optional: true },
  { id: 'unknown', label: 'Sem tipo', icon: 'cards', optional: true },
];

const cardsLabel = (count: number) => count === 1 ? '1 carta' : `${count} cartas`;

function selectLabel(filtered: Card[], total: number, selectedIDs: string[]) {
  const everything = filtered.length === total;
  if (filtered.length && filtered.every(card => selectedIDs.includes(card.id))) return everything ? 'Desmarcar todas' : 'Desmarcar resultados';
  if (everything) return 'Selecionar todas';
  return filtered.length === 1 ? 'Selecionar 1 resultado' : `Selecionar os ${filtered.length} resultados`;
}

type Props = PanelFeedbackProps & {
  state: ReturnType<typeof useLibraryConsultation>;
  pool: Card[];
  consultedIDs: string[];
  libraryCount: number;
  closeAttempted: boolean;
  onInspect: (card: Card) => void;
  onClosed: () => void;
};

export function LibrarySearchSheet({ state, pool, consultedIDs, libraryCount, closeAttempted, onInspect, onClosed, error, busy: requestBusy, unconfirmed, onRetry }: Props) {
  const busy = requestBusy || unconfirmed;
  const [zone, setZone] = useState<Zone>('hand');
  const [side, setSide] = useState<Side>('top');
  const [sent, setSent] = useState(false);
  // Also notices a send confirmed through "Tentar novamente".
  const poolSize = useRef(pool.length);
  useEffect(() => {
    if (pool.length < poolSize.current) setSent(true);
    poolSize.current = pool.length;
  }, [pool.length]);
  const chosen = pool.filter(card => state.selectedIDs.includes(card.id));
  const hasChoice = chosen.length > 0;
  const closing = sent || closeAttempted;
  const destination = zones.find(item => item.id === zone)!;
  const publicCount = pool.filter(card => card.revealed).length;
  const sentence = destination.ordered ? `para o ${side === 'top' ? 'topo' : 'fundo'} ${destination.destination}` : destination.destination;
  const send = async () => {
    const succeeded = zone === 'library' ? await state.sendToLibrary(side, consultedIDs) : await state.move(zone, destination.ordered ? side : undefined);
    if (succeeded) setSent(true);
  };
  const close = (shuffle: boolean) => void state.finish(shuffle).then(succeeded => { if (succeeded) onClosed(); });
  return <>
    {(['tl', 'tr', 'bl', 'br'] as const).map(corner => <i key={corner} className={`search-corner search-corner-${corner}`} aria-hidden="true" />)}
    <header className="search-header">
      <div className="search-pile" aria-hidden="true"><span /><span /><LibraryCardBack /><b>{libraryCount}</b></div>
      <div className="search-title">
        <h2>Buscar no grimório</h2>
        <p><TableIcon name="eye" />{publicCount ? `${publicCount} carta(s) visível(is) para todos` : 'Só você vê estas cartas'}</p>
      </div>
      <p className={`search-exit-hint ${closing ? 'attention' : ''}`}><TableIcon name="lock" />Para sair, escolha embaralhar ou não<TableIcon name="arrow-down" /></p>
    </header>
    <div className="search-tools">
      <div className="search-tools-row">
        <div className={`search-field ${state.search ? 'filled' : ''}`}>
          <TableIcon name="search" />
          <input aria-label="Buscar no grimório" placeholder="Buscar por nome" disabled={busy} value={state.search} onChange={event => state.setSearch(event.target.value)} />
          {state.search && <button type="button" aria-label="Limpar busca" onClick={() => state.setSearch('')}><TableIcon name="close" /></button>}
        </div>
        <span className="search-total"><b>{state.filtered.length}</b> de {cardsLabel(pool.length)}</span>
        <button type="button" className="search-select-all" disabled={busy || !state.filtered.length} onClick={state.selectResults}><TableIcon name="check-square" />{selectLabel(state.filtered, pool.length, state.selectedIDs)}</button>
      </div>
      <div className="search-chips" role="group" aria-label="Filtrar por tipo">
        <TypeChip label="Todos" icon="cards" count={state.namedCount} active={!state.typeFilter} onClick={() => state.setTypeFilter('')} />
        {types.map(type => {
          const count = state.countType(type.id);
          if (type.optional && !count) return null;
          return <TypeChip key={type.id} label={type.label} icon={type.icon} count={count} active={state.typeFilter === type.id} onClick={() => state.setTypeFilter(type.id)} />;
        })}
      </div>
    </div>
    {error && <div className="search-feedback">
      <PanelFeedback error={error} busy={requestBusy} unconfirmed={unconfirmed} onRetry={onRetry} />
    </div>}
    <LibrarySearchCards cards={pool} filtered={state.filtered} selectedIDs={state.selectedIDs} busy={busy} onSelect={state.toggle} onInspect={onInspect} onReorder={state.reorder} />
    <section className={`search-step-one ${hasChoice ? 'has-choice' : ''}`} role="region" aria-label="Ações da seleção">
      <h3 className="search-step-label"><i>1</i><span>Cartas<br />escolhidas</span></h3>
      <div className="search-choice">
        {hasChoice ? <>
          <div className="search-thumbs" aria-hidden="true">{chosen.slice(0, 3).map(card => <img key={card.id} src={cardImageURL(card)} alt="" draggable={false} />)}</div>
          <div><strong>{chosen.length === 1 ? '1 selecionada' : `${chosen.length} selecionadas`}</strong><button type="button" className="search-clear" disabled={busy} onClick={state.clearSelection}>limpar seleção</button></div>
        </> : <>
          <span className="search-choice-empty" aria-hidden="true"><TableIcon name="card-pick" /></span>
          <div><strong>Nenhuma ainda</strong><small>Clique nas cartas acima para escolher</small></div>
        </>}
      </div>
      <div className="search-destination">
        <span className="search-control-label">Para onde</span>
        <div className="search-zones" role="group" aria-label="Para onde">
          {zones.map(item => <button key={item.id} type="button" aria-pressed={zone === item.id} disabled={!hasChoice || busy} onClick={() => setZone(item.id)}><TableIcon name={item.icon} />{item.label}</button>)}
        </div>
      </div>
      <div className={`search-position ${destination.ordered && hasChoice ? '' : 'inactive'}`}>
        <span className="search-control-label">{destination.ordered ? 'Posição' : 'Posição · não se aplica'}</span>
        <div role="group" aria-label="Posição">
          {([['top', 'Topo', 'arrow-up'], ['bottom', 'Fundo', 'arrow-down']] as const).map(([id, label, icon]) => <button key={id} type="button" aria-pressed={destination.ordered && hasChoice && side === id} disabled={!destination.ordered || !hasChoice || busy} onClick={() => setSide(id)}><TableIcon name={icon} />{label}</button>)}
        </div>
      </div>
      <button type="button" className="search-send" disabled={!hasChoice || busy} onClick={() => void send()}>
        <strong>{hasChoice ? `Enviar ${cardsLabel(chosen.length)}` : 'Enviar as cartas'}</strong>
        <small>{sentence}</small>
      </button>
    </section>
    <section className={`search-step-two ${closing ? 'attention' : ''}`} role="region" aria-label="Fechar a busca">
      <h3 className="search-step-label"><i>2</i><span>Fechar a busca</span><small>escolha uma das duas</small>{closing && <em role="status">A busca só fecha por um destes botões.</em>}</h3>
      <div className="search-close-actions">
        <button type="button" aria-label="Fechar sem embaralhar" className="search-close" disabled={busy} onClick={() => close(false)}>
          <i><TableIcon name="stack" /></i>
          <span><strong>Fechar sem embaralhar</strong><small>O grimório fica na ordem exibida acima</small></span>
          <TableIcon name="next" />
        </button>
        <b className="search-or" aria-hidden="true">ou</b>
        <button type="button" aria-label="Embaralhar e fechar" className="search-close search-close-primary" disabled={busy} onClick={() => close(true)}>
          <i><TableIcon name="library-shuffle" /></i>
          <span><strong>Embaralhar e fechar</strong><small>O grimório inteiro é embaralhado</small></span>
          <TableIcon name="next" />
        </button>
      </div>
    </section>
  </>;
}

function TypeChip({ label, icon, count, active, onClick }: { label: string; icon: TableIconName; count: number; active: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-pressed={active} className={`search-chip ${count ? '' : 'empty'}`} disabled={!count && !active} onClick={onClick}><TableIcon name={icon} />{label}<b>{count}</b></button>;
}
