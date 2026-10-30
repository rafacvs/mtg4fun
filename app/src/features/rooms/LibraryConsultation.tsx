import { useEffect, useState } from 'react';
import { PanelFeedback, PanelHeader, TablePanel } from './TablePanel';
import { LibraryCards } from './LibraryCards';
import { LibraryMenu } from './LibraryMenu';
import { LibrarySearchSheet } from './LibrarySearchSheet';
import { LibrarySetup } from './LibrarySetup';
import { seatColors } from './PlayerSeat';
import { TableIcon } from './TableIcon';
import type { Card, Match } from './roomsApi';
import {
  useLibraryConsultation,
  type LibraryOperations,
  type LibrarySource,
} from './useLibraryConsultation';
import './game-actions.css';
import './library.css';
import './library-menu.css';

type Props = LibraryOperations & {
  open: boolean;
  match: Match;
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
  const { open, match, cards, revealed, consultationFrom, libraryCount, error, onInspect, onDismiss } =
    props;
  const busy = props.busy || props.unconfirmed;
  const pool = [
    ...cards,
    ...revealed.filter((card) => !cards.some((consulted) => consulted.id === card.id)),
  ];
  const state = useLibraryConsultation(pool, props, consultationFrom);
  const active = Boolean(consultationFrom || pool.length);
  const searching = consultationFrom === 'all' || (!consultationFrom && cards.length > 0);
  const searchSheet = active && searching;
  const publicCount = pool.filter((card) => card.revealed).length;
  const [closeAttempted, setCloseAttempted] = useState(false);
  const title = active
    ? publicCount === pool.length && pool.length
      ? 'Cartas reveladas'
      : `Olhar cartas do ${consultationFrom === 'bottom' ? 'fundo' : 'topo'}`
    : state.view === 'look'
      ? 'Olhar cartas'
      : state.view === 'reveal'
        ? 'Revelar cartas'
        : state.view === 'draw'
          ? 'Comprar cartas'
          : 'Grimório';

  const { resetScreen } = state;
  useEffect(() => { if (!open) resetScreen(); }, [open, resetScreen]);
  useEffect(() => { if (!searchSheet) setCloseAttempted(false); }, [searchSheet]);

  if (!open) return null;

  // The search only ends through its two buttons; every other way out just points at them.
  if (searchSheet) {
    return (
      <TablePanel open anchor={props.anchor} wide blocking onClose={() => setCloseAttempted(true)} label="Grimório" className="library-consultation library-active library-search-sheet">
        <LibrarySearchSheet
          state={state}
          pool={pool}
          consultedIDs={cards.map((card) => card.id)}
          libraryCount={libraryCount}
          closeAttempted={closeAttempted}
          error={error}
          busy={props.busy}
          unconfirmed={props.unconfirmed}
          onRetry={props.onRetry}
          onInspect={onInspect}
          onClosed={onDismiss}
        />
      </TablePanel>
    );
  }

  const selectedCount = state.selectedIDs.length;
  const viewers = match.players.filter(player => player.userId !== match.viewerId).map(player => ({
    userId: player.userId,
    name: player.name,
    position: match.turnOrder.findIndex(item => item.userId === player.userId) + 1,
    color: seatColors[match.players.indexOf(player) % seatColors.length],
  })).sort((first, second) => first.position - second.position);
  return (
    <TablePanel
      open={open}
      anchor={props.anchor}
      aboveDock
      onClose={onDismiss}
      label="Grimório"
      className={`library-consultation library-framed ${active ? 'library-active' : ''}`}
    >
      <PanelHeader title={title} subtitle={libraryCount === 1 ? '1 carta' : `${libraryCount} cartas`} onClose={onDismiss} closeLabel={active ? "Minimizar consulta" : "Fechar painel do grimório"} />
      <PanelFeedback error={error} busy={props.busy} unconfirmed={props.unconfirmed} onRetry={props.onRetry} />
      {state.notice && (
        <p role="status" className="panel-result">
          {state.notice}
        </p>
      )}
      {!active && state.view === 'menu' && (
        <LibraryMenu
          disabled={busy}
          empty={!libraryCount}
          onDraw={() => state.choose('draw')}
          onShuffle={() => void state.finish(true)}
          onLook={() => state.choose('look')}
          onSearch={() => void state.searchLibrary()}
          onReveal={() => state.choose('reveal')}
        />
      )}
      {!active && state.view !== 'menu' && (
        <LibrarySetup
          view={state.view}
          source={state.source}
          count={state.count}
          libraryCount={libraryCount}
          busy={busy}
          viewers={viewers}
          onSource={state.setSource}
          onCount={state.setCount}
          onBegin={() => void state.begin()}
          onCancel={() => state.choose('menu')}
        />
      )}
      {active && (
        <p className={`library-pill ${publicCount ? 'public' : ''}`}>
          <TableIcon name={publicCount ? 'sun' : 'lock'} />
          {publicCount ? `${publicCount} carta(s) visível(is) para todos` : 'Só você vê estas cartas'}
        </p>
      )}
      {active && (
        <>
          <div className="library-body">
          <div className="grimorio-workspace">
            <p className="library-order">
              Ordem no grimório: primeira → última · Arraste pela alça ou use as teclas de direção.
            </p>
            <LibraryCards
              cards={pool}
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
                className="secondary"
                disabled={busy}
                onClick={() => void state.finish(true).then(succeeded => { if (succeeded) onDismiss(); })}
              >
                Embaralhar e fechar
              </button>
              <button
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
