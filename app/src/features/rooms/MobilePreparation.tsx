import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardCount } from '../decks/deckDisplay';
import type { useDecks } from '../decks/useDecks';
import type { Room } from './roomsApi';
import type { useRooms } from './useRooms';
import { PreparationRules } from './PreparationRules';

type Props = { room: Room; participant: Room['participants'][number]; userId: number; deckId: string; setDeckId: Dispatch<SetStateAction<string>>; decks: ReturnType<typeof useDecks>; rooms: ReturnType<typeof useRooms>; sharedDecks: { playerId: number; name: string; image?: string }[] };

type Panel = 'deck' | 'rules' | null;
export function MobilePreparation({ room, participant, userId, deckId, setDeckId, decks, rooms, sharedDecks }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const waiting = room.participants.filter(player => !player.ready);
  const selectedDeck = decks.decks.find(deck => String(deck.id) === deckId);
  const artwork = selectedDeck?.commander || selectedDeck?.cards.find(card => card.available)?.name;
  const players = [participant, ...room.participants.filter(player => player.id !== userId)];
  const canStart = room.creatorId === userId && waiting.length === 0;
  const showPanel = (next: Exclude<Panel, null>, element: HTMLElement) => { trigger.current = element; setPanel(next); };
  const closePanel = () => { if (!settingsPending) setPanel(null); };
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (panel && !node.open) node.showModal();
    if (!panel && node.open) { node.close(); trigger.current?.focus(); }
  }, [panel]);
  return <section className="mobile-preparation" aria-label="Preparação da sala">
    <header className="mobile-preparation-heading"><div><p className="eyebrow">{waiting.length ? 'A MESA ESTÁ SE FORMANDO' : 'TODOS PRONTOS'}</p><h2>{room.title}</h2></div><button type="button" className="secondary mobile-rules-open" onClick={event => showPanel('rules', event.currentTarget)}>☷ &nbsp; Regras</button></header>
    <div className="mobile-room-facts"><span>{room.format || 'Mesa'}</span><span>♥ {room.life} de vida</span><span>Mulligan em breve</span><span>{room.participants.length}/{room.seats}</span></div>
    <section className="mobile-preparation-table" aria-label="Jogadores à mesa">
      <div className="mobile-preparation-oval">{room.participants.filter(player => player.deckId).map((player, index) => <img key={player.id} className={`mobile-oval-pile mobile-oval-pile-${index}`} src="/library-back.png" alt="" aria-hidden="true" />)}<div><strong>{room.participants.length - waiting.length}/{room.participants.length}</strong><small>PRONTOS</small></div></div>
      {room.participants.map(player => {
        const index = room.participants.findIndex(item => item.id === player.id);
        const position = player.id === userId ? 3 : [5, 1, 0, 2, 4][room.participants.filter(item => item.id !== userId).findIndex(item => item.id === player.id)];
        return <div key={player.id} className={`mobile-table-seat mobile-table-seat-${position} seat-color-${index % 6}`}><span className="mobile-seat-emblem">{player.name.slice(0, 1).toUpperCase()}{player.ready && <b>✓</b>}</span><small>{player.id === userId ? 'você' : player.name}</small></div>;
      })}
      {[5, 1, 0, 2, 4].slice(room.participants.length - 1, room.seats - 1).map(position => <div key={position} className={`mobile-table-seat mobile-table-seat-${position} mobile-free-seat`} aria-hidden="true"><span>＋</span><small>livre</small></div>)}
    </section>
    <section className="mobile-players" aria-label="Jogadores"><div className="mobile-players-heading"><span>JOGADORES</span><small>{room.vacancies} {room.vacancies === 1 ? 'lugar livre' : 'lugares livres'}</small></div>
      <ul>{players.map(player => {
        const own = player.id === userId; const index = room.participants.findIndex(value => value.id === player.id);
        const shared = sharedDecks.find(deck => deck.playerId === player.id); const image = own ? artwork : shared?.image;
        return <li key={player.id} className={`mobile-player seat-color-${index % 6} ${own ? 'is-own' : ''}`}>
          <span className="mobile-player-art">{image ? <img src={deckApi.imageURL(image)} alt="" onError={event => { event.currentTarget.src = '/library-back.png'; }} /> : <img src="/library-back.png" alt="" />}</span>
          <span className="mobile-player-copy"><strong>{player.name}{own && <small> · você</small>}{own && !player.ready && <span className="mobile-inline-ready"> Preparando</span>}</strong><small>{own ? selectedDeck?.name || 'Sem deck' : shared?.name || (player.deckId ? 'Deck selecionado' : 'Aguardando deck')}{own && selectedDeck ? ` · ${cardCount(selectedDeck.cards)} cartas` : ''}</small></span>
          {own && !participant.ready ? <button type="button" className="secondary mobile-change-deck" onClick={event => showPanel('deck', event.currentTarget)}>Trocar ›</button> : <span className={`preparation-ready ${player.ready ? 'is-ready' : ''}`}>{player.ready ? '✓ Pronto' : '✦ Preparando'}</span>}
        </li>;
      })}</ul>
    </section>
    <footer className="mobile-preparation-footer"><div className="mobile-waiting"><span role="status">{waiting.length ? `Ainda falta: ${waiting.map(player => player.name).join(', ')}.` : 'Todos prontos.'}</span>{participant.ready && <button type="button" className="text-button" disabled={rooms.busy} onClick={() => void rooms.unready(room.id)}>desfazer pronto</button>}</div>
      {canStart ? <button type="button" disabled={rooms.busy || settingsPending} onClick={() => void rooms.start(room.id)}>Iniciar partida <span aria-hidden="true">→</span></button> : !participant.ready ? <button type="button" disabled={rooms.busy || !deckId} onClick={() => void rooms.ready(room.id)}>Estou pronto <span aria-hidden="true">→</span></button> : <p>Aguardando os demais jogadores.</p>}
      {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
    </footer>
    <dialog ref={dialog} className="mobile-preparation-dialog" data-editable={room.creatorId === userId} aria-label={panel === 'rules' ? 'Regras da mesa' : 'Seu deck'} onCancel={event => { event.preventDefault(); closePanel(); }} onClick={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="mobile-dialog-heading"><h3>{panel === 'rules' ? 'Regras da mesa' : 'Seu deck'}</h3><button type="button" className="secondary" aria-label="Fechar painel" disabled={settingsPending} onClick={closePanel}>×</button></div>
      {panel === 'deck' && <div className="mobile-deck-panel">
        {decks.error && <p role="alert" className="error">{decks.error}</p>}
        {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
        {!decks.loading && decks.decks.length === 0 && <p><a href="/#/decks">Importe um deck</a> e volte a esta sala para confirmar.</p>}
        <label htmlFor="mobile-room-deck">Deck para a partida</label><select id="mobile-room-deck" value={deckId} disabled={decks.loading || rooms.busy || participant.ready} onChange={event => { const value = event.target.value; setDeckId(value); if (value) void rooms.selectDeck(room.id, Number(value)).then(ok => { if (!ok) setDeckId(participant.deckId ? String(participant.deckId) : ''); }); }}><option value="">Selecione um deck</option>{decks.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>
        <div className="mobile-selected-deck" aria-label="Deck escolhido"><span className="mobile-selected-art">{selectedDeck ? <img src={artwork ? deckApi.imageURL(artwork) : '/library-back.png'} alt="" onError={event => { event.currentTarget.src = '/library-back.png'; }} /> : <span aria-hidden="true">✧</span>}</span><div>{selectedDeck ? <><span className="preparation-deck-label">DECK ESCOLHIDO</span><strong>{selectedDeck.name}</strong><small>{cardCount(selectedDeck.cards)} cartas</small></> : <strong>Sem deck</strong>}</div></div>
        <button type="button" disabled={!deckId || rooms.busy} onClick={closePanel}>Usar este deck</button>
      </div>}
      {panel === 'rules' && <>{rooms.error && <p role="alert" className="error">{rooms.error}</p>}<PreparationRules room={room} editable={room.creatorId === userId} busy={rooms.busy} onPendingChange={setSettingsPending} onChange={settings => rooms.settings(room.id, settings)} /><button type="button" className="mobile-panel-done" disabled={settingsPending || rooms.busy} onClick={closePanel}>{room.creatorId === userId ? 'Concluído' : 'Fechar'}</button></>}
    </dialog>
  </section>;
}
