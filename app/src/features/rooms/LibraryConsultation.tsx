import { MenuItem, PanelFeedback, PanelHeader, TablePanel } from './TablePanel';
import { LibraryCards } from './LibraryCards';
import type { Card } from './roomsApi';
import {
  useLibraryConsultation,
  type LibraryOperations,
  type LibrarySource,
} from './useLibraryConsultation';
import './library.css';

type Props = LibraryOperations & {
  open: boolean;
  anchor: HTMLElement | null;
  cards: Card[];
  revealed: Card[];
  consultationFrom?: LibrarySource;
  libraryCount: number;
  busy: boolean;
  error: string;
  unconfirmed: boolean;
  onRetry: () => Promise<boolean>;
  onInspect: (card: Card) => void;
  onDismiss: () => void;
};

export function LibraryConsultation(props: Props) {
  const { open, cards, revealed, consultationFrom, libraryCount, error, onInspect, onDismiss } =
    props;
  const busy = props.busy || props.unconfirmed;
  const pool = [
    ...cards,
    ...revealed.filter((card) => !cards.some((consulted) => consulted.id === card.id)),
  ];
  const state = useLibraryConsultation(pool, props, consultationFrom);
  const active = Boolean(consultationFrom || pool.length);
  const searching = consultationFrom === 'all' || (!consultationFrom && cards.length > 0);
  const publicCount = pool.filter((card) => card.revealed).length;
  const title = active
    ? searching
      ? consultationFrom
        ? 'Buscar no grimório'
        : 'Consulta em andamento'
      : publicCount === pool.length && pool.length
        ? 'Cartas reveladas'
        : `Olhar cartas do ${consultationFrom === 'bottom' ? 'fundo' : 'topo'}`
    : state.view === 'look'
      ? 'Olhar cartas'
      : state.view === 'reveal'
        ? 'Revelar cartas'
        : state.view === 'draw'
          ? 'Comprar cartas'
          : 'Grimório';

  if (!open) return null;

  const selectedCount = state.selectedIDs.length;
  const validCount =
    Number.isInteger(state.count) && state.count >= 1 && state.count <= libraryCount;
  return (
    <TablePanel
      open={open}
      anchor={props.anchor}
      wide={active}
      onClose={onDismiss}
      label="Grimório"
      className={`library-consultation ${active ? 'library-active' : ''}`}
    >
      <PanelHeader title={title} subtitle={libraryCount === 1 ? '1 carta' : `${libraryCount} cartas`} onClose={onDismiss} closeLabel={active ? "Minimizar consulta" : "Fechar painel do grimório"} onBack={!active && state.view !== 'menu' ? () => state.choose('menu') : undefined}>
      {active && (
            <p className={`library-visibility ${publicCount ? 'public' : ''}`}>
              {publicCount
                ? `${publicCount} carta(s) visível(is) para todos`
                : 'Só você vê estas cartas'}
            </p>
          )}
      </PanelHeader>
      <PanelFeedback error={error} busy={props.busy} unconfirmed={props.unconfirmed} onRetry={props.onRetry} />
      {state.notice && (
        <p role="status" className="panel-result">
          {state.notice}
        </p>
      )}
      {!active && state.view === 'menu' && (
        <div className="table-menu library-menu">
          <MenuItem icon="draw" title="Comprar cartas" description="Do topo para sua mão" disabled={busy || !libraryCount} onClick={() => state.choose('draw')} />
          <MenuItem icon="shuffle" title="Embaralhar" description="Embaralhar apenas o grimório" disabled={busy} opens={false} onClick={() => void state.finish(true)} />
          <MenuItem icon="eye" title="Olhar cartas" description="Topo ou fundo · Em privado" disabled={busy || !libraryCount} onClick={() => state.choose('look')} />
          <MenuItem icon="search" title="Buscar no grimório" description="Consultar todas · Em privado" disabled={busy || !libraryCount} onClick={() => void state.searchLibrary()} />
          <MenuItem icon="reveal" title="Revelar cartas" description="Do topo · Todos veem" disabled={busy || !libraryCount} onClick={() => state.choose('reveal')} />
        </div>
      )}
      {!active && state.view !== 'menu' && (
        <div className="library-setup">
          <p>
            {state.view === 'look'
              ? 'Só você verá estas cartas.'
              : state.view === 'reveal'
                ? 'Estas cartas serão mostradas a todos os jogadores.'
                : 'Coloque cartas do topo na sua mão.'}
          </p>
          <div className="library-command">
            {state.view === 'look' && (
              <div className="panel-field">
                <span className="panel-label" id="library-source-label">De onde</span>
                <div className="segmented" role="group" aria-labelledby="library-source-label">
                  {(['top', 'bottom'] as const).map(source => <button key={source} type="button" aria-pressed={state.source === source} disabled={busy} onClick={() => state.setSource(source)}>{source === 'top' ? 'Topo' : 'Fundo'}</button>)}
                </div>
              </div>
            )}
            <div className="panel-field">
              <span className="panel-label">Quantidade</span>
              <div className="library-stepper">
                <button
                  className="secondary"
                  aria-label="Diminuir quantidade"
                  disabled={busy || state.count <= 1}
                  onClick={() => state.setCount(state.count - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label="Quantidade de cartas"
                  min="1"
                  max={libraryCount}
                  disabled={busy}
                  value={state.count}
                  onChange={(event) => state.setCount(Number(event.target.value))}
                />
                <button
                  className="secondary"
                  aria-label="Aumentar quantidade"
                  disabled={busy || state.count >= libraryCount}
                  onClick={() => state.setCount(state.count + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="library-setup-actions">
            <button className="panel-primary" disabled={busy || !validCount} onClick={() => void state.begin()}>
              {state.view === 'look' ? 'Olhar' : state.view === 'reveal' ? 'Revelar' : 'Comprar'}{' '}
              {state.count || ''} carta(s)
            </button>
          </div>
        </div>
      )}
      {active && (
        <>
          <div className="library-body">
          <div className="grimorio-workspace">
            {searching && (
              <div className="library-search">
                <input
                  aria-label="Buscar no grimório"
                  placeholder="Buscar por nome"
                  disabled={busy}
                  value={state.search}
                  onChange={(event) => state.setSearch(event.target.value)}
                />
                <label>Tipo
                  <select aria-label="Filtrar por tipo" value={state.typeFilter} disabled={busy} onChange={event => state.setTypeFilter(event.target.value)}>
                    <option value="">Todos os tipos</option>
                    <option value="Creature">Criaturas</option>
                    <option value="Land">Terrenos</option>
                    <option value="Artifact">Artefatos</option>
                    <option value="Enchantment">Encantamentos</option>
                    <option value="Instant">Instantâneas</option>
                    <option value="Sorcery">Feitiços</option>
                    <option value="Planeswalker">Planeswalkers</option>
                    <option value="Battle">Batalhas</option>
                    <option value="unknown">Tipo indisponível</option>
                  </select>
                </label>
                <button
                  className="text-button"
                  disabled={busy || !state.filtered.length}
                  onClick={state.selectResults}
                >
                  {state.filtered.length &&
                  state.filtered.every((card) => state.selectedIDs.includes(card.id))
                    ? 'Desmarcar resultados'
                    : 'Selecionar resultados'}
                </button>
              </div>
            )}
            {!searching && (
              <p className="library-order">
                Ordem no grimório: primeira → última · Arraste pela alça ou use as teclas de direção.
              </p>
            )}
            <LibraryCards
              cards={pool}
              layout={searching ? 'grid' : 'strip'}
              filtered={state.filtered}
              selectedIDs={state.selectedIDs}
              busy={busy}
              onSelect={state.toggle}
              onInspect={onInspect}
              onReorder={state.reorder}
            />
          </div>
          {selectedCount > 0 && (
            <div className="library-selection" role="region" aria-label="Ações da seleção">
              <span>{selectedCount} selecionada(s)</span>
              {[
                ['Mão', 'hand'], ['Campo', 'battlefield'], ['Cemitério', 'graveyard'],
                ['Exílio', 'exile'], ['Topo', 'library', 'top'], ['Fundo', 'library', 'bottom'],
                ['Comando', 'command'],
              ].map(([label, zone, placement]) => <button key={label} className="secondary" disabled={busy} onClick={() => void state.move(zone, placement as 'top' | 'bottom' | undefined)}>{label}</button>)}
              <button className="secondary" disabled={busy || state.selectedIDs.every(id => cards.find(card => card.id === id)?.revealed)} onClick={() => void state.reveal()}>Revelar</button>
            </div>
          )}
          </div>
          <footer className="library-finish">
            <div>
              <label>
                Devolver {pool.length} restante(s) ao
                <select
                  aria-label="Destino das restantes"
                  disabled={busy}
                  value={state.placement}
                  onChange={(event) => state.setPlacement(event.target.value as 'top' | 'bottom')}
                >
                  <option value="top">Topo do grimório</option>
                  <option value="bottom">Fundo do grimório</option>
                </select>
              </label>
              <small>Na ordem exibida, da primeira à última.</small>
            </div>
            <div className="library-finish-actions">
              <button
                className={searching ? '' : 'secondary'}
                disabled={busy}
                onClick={() => void state.finish(true).then(succeeded => { if (succeeded) onDismiss(); })}
              >
                Embaralhar e fechar
              </button>
              <button
                className={searching ? 'secondary' : ''}
                disabled={busy}
                onClick={() => void state.finish().then(succeeded => { if (succeeded) onDismiss(); })}
              >
                Fechar sem embaralhar
              </button>
            </div>
          </footer>
        </>
      )}
    </TablePanel>
  );
}
