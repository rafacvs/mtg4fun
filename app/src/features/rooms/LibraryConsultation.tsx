import { useEffect, useRef } from 'react';
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const pool = [
    ...cards,
    ...revealed.filter((card) => !cards.some((consulted) => consulted.id === card.id)),
  ];
  const state = useLibraryConsultation(pool, props, consultationFrom);
  const active = Boolean(consultationFrom || pool.length);
  const searching = consultationFrom === 'all' || (!consultationFrom && cards.length > 0);
  const publicCount = pool.filter((card) => card.revealed || card.zone === 'revealed').length;
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

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.card-preview')) {
        event.stopImmediatePropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);
  if (!open) return null;

  const selectedCount = state.selectedIDs.length;
  const validCount =
    Number.isInteger(state.count) && state.count >= 1 && state.count <= libraryCount;
  return (
    <div
      className={`actions-panel library-consultation ${active ? 'library-active' : ''}`}
      role="dialog"
      aria-label="Grimório"
    >
      <header>
        <div>
          <p className="actions-kicker">Grimório · {libraryCount} carta(s) disponível(is)</p>
          <h2>{title}</h2>
          {active && (
            <p className={`library-visibility ${publicCount ? 'public' : ''}`}>
              {publicCount
                ? `◉ ${publicCount} carta(s) visível(is) para todos`
                : '◈ Só você vê estas cartas'}
            </p>
          )}
        </div>
        <button
          ref={closeRef}
          type="button"
          className="secondary"
          aria-label="Fechar painel do grimório"
          onClick={onDismiss}
        >
          ×
        </button>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
          {props.unconfirmed && (
            <button disabled={props.busy} onClick={() => void props.onRetry()}>
              Tentar novamente
            </button>
          )}
        </p>
      )}
      {state.notice && (
        <p role="status" className="library-notice">
          {state.notice}
        </p>
      )}
      {!active && state.view === 'menu' && (
        <div className="library-menu">
          <button
            className="secondary"
            disabled={busy || !libraryCount}
            onClick={() => state.choose('draw')}
          >
            <strong>Comprar cartas</strong>
            <span>Do topo para sua mão</span>
          </button>
          <button className="secondary" disabled={busy} onClick={() => void state.finish(true)}>
            <strong>Embaralhar</strong>
            <span>Embaralhar apenas o grimório</span>
          </button>
          <button
            className="secondary"
            disabled={busy || !libraryCount}
            onClick={() => state.choose('look')}
          >
            <strong>Olhar cartas</strong>
            <span>Topo ou fundo · Em privado</span>
          </button>
          <button
            className="secondary"
            disabled={busy || !libraryCount}
            onClick={() => void state.searchLibrary()}
          >
            <strong>Buscar no grimório</strong>
            <span>Consultar todas · Em privado</span>
          </button>
          <button
            className="secondary"
            disabled={busy || !libraryCount}
            onClick={() => state.choose('reveal')}
          >
            <strong>Revelar cartas</strong>
            <span>Do topo · Todos veem</span>
          </button>
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
              <label>
                De onde
                <select
                  disabled={busy}
                  value={state.source}
                  onChange={(event) => state.setSource(event.target.value as 'top' | 'bottom')}
                >
                  <option value="top">Topo</option>
                  <option value="bottom">Fundo</option>
                </select>
              </label>
            )}
            <label>
              Quantidade
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
            </label>
          </div>
          <div className="library-setup-actions">
            <button className="secondary" disabled={busy} onClick={() => state.choose('menu')}>
              Voltar
            </button>
            <button disabled={busy || !validCount} onClick={() => void state.begin()}>
              {state.view === 'look' ? 'Olhar' : state.view === 'reveal' ? 'Revelar' : 'Comprar'}{' '}
              {state.count || ''} carta(s)
            </button>
          </div>
        </div>
      )}
      {active && (
        <>
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
                Ordem no grimório: primeira → última · Arraste pela alça à esquerda da imagem.
              </p>
            )}
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
            <div className="library-selection" aria-label="Ações da seleção">
              <span>{selectedCount} selecionada(s)</span>
              <button className="secondary" disabled={busy} onClick={() => void state.move('hand')}>
                Colocar {selectedCount} na mão
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void state.move('library', 'bottom')}
              >
                No fundo
              </button>
              <label className="library-other">
                <span>Outros destinos</span>
                <select
                  aria-label="Outros destinos"
                  disabled={busy}
                  value=""
                  onChange={(event) => {
                    const [to, placement] = event.target.value.split(':');
                    if (to) void state.move(to, placement as 'top' | 'bottom' | undefined);
                  }}
                >
                  <option value="">Escolher…</option>
                  <option value="battlefield">Campo</option>
                  <option value="graveyard">Cemitério</option>
                  <option value="exile">Exílio</option>
                  <option value="command">Comando</option>
                  <option value="library:top">Topo do grimório</option>
                </select>
              </label>
              {cards.length > 0 && (
                <button
                  className="secondary"
                  disabled={
                    busy ||
                    state.selectedIDs.every((id) => cards.find((card) => card.id === id)?.revealed)
                  }
                  onClick={() => void state.reveal()}
                >
                  Revelar seleção
                </button>
              )}
            </div>
          )}
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
                onClick={() => void state.finish(true)}
              >
                Devolver e embaralhar
              </button>
              <button
                className={searching ? 'secondary' : ''}
                disabled={busy}
                onClick={() => void state.finish()}
              >
                Devolver sem embaralhar
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
