import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { deckApi } from '../decks/deckApi';
import { cardCount, colorNames } from '../decks/deckDisplay';
import type { useDecks } from '../decks/useDecks';
import type { Room } from './roomsApi';
import type { useRooms } from './useRooms';
import { PreparationRules } from './PreparationRules';
import { MobilePreparation } from './MobilePreparation';
import './room-preparation.css';
import './mobile-preparation.css';

type Props = {
  room: Room;
  participant: Room['participants'][number];
  userId: number;
  deckId: string;
  setDeckId: Dispatch<SetStateAction<string>>;
  decks: ReturnType<typeof useDecks>;
  rooms: ReturnType<typeof useRooms>;
};

export function RoomPreparation({ room, participant, userId, deckId, setDeckId, decks, rooms }: Props) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 800px), (max-width: 1000px) and (pointer: coarse)').matches);
  useEffect(() => { const media = window.matchMedia('(max-width: 800px), (max-width: 1000px) and (pointer: coarse)'); const update = () => setMobile(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const [settingsPending, setSettingsPending] = useState(false);
  const [sharedDecks, setSharedDecks] = useState<{ playerId: number; name: string; image?: string }[]>([]);
  const deckSelection = room.participants.map(player => `${player.id}:${player.deckId ?? 0}`).join(',');
  useEffect(() => {
    const controller = new AbortController();
    setSharedDecks([]);
    void fetch(`/api/rooms/${room.id}/preparation-decks`, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Não foi possível carregar os decks da mesa.');
      return response.json();
    }).then(data => setSharedDecks(data.decks)).catch(() => { if (!controller.signal.aborted) setSharedDecks([]); });
    return () => controller.abort();
  }, [room.id, deckSelection]);
  const waiting = room.participants.filter(player => !player.ready);
  const selectedDeck = decks.decks.find(deck => String(deck.id) === deckId);
  const artwork = selectedDeck?.commander || selectedDeck?.cards.find(card => card.available)?.name;
  const readyCount = room.participants.length - waiting.length;
  if (mobile) return <MobilePreparation room={room} participant={participant} userId={userId} deckId={deckId} setDeckId={setDeckId} decks={decks} rooms={rooms} sharedDecks={sharedDecks} />;
  return <section className="room-preparation" aria-label="Preparação da sala">
    <div className="preparation-content">
      <section className="preparation-table" aria-label="Jogadores à mesa">
        <header className="preparation-heading">
          <div><p className="eyebrow">A MESA ESTÁ SE FORMANDO</p><h2>À mesa</h2></div>
          <div className="preparation-room-facts"><span>{room.format || 'Mesa'}</span><span>♥ {room.life} de vida</span><span>{room.participants.length}/{room.seats} jogadores</span></div>
        </header>
        <div className="preparation-arena">
          <div className="preparation-oval" aria-hidden="true">{room.participants.filter(player => player.deckId).map(player => { const others = room.participants.filter(value => value.id !== userId); const position = player.id === userId ? 2 : [0, 1, 3, 5, 4][others.findIndex(value => value.id === player.id)]; return <img key={player.id} className={`preparation-pile preparation-pile-${position}`} src="/library-back.png" alt="" />; })}<div className="preparation-oval-center"><strong>{readyCount}/{room.participants.length}</strong><span>PRONTOS</span></div></div>
          <ul className="preparation-seats">{[...room.participants.filter(player => player.id !== userId), participant].map(player => {
            const index = room.participants.findIndex(value => value.id === player.id);
            const own = player.id === userId;
            const seat = own ? 3 : [0, 5, 1, 4, 2][room.participants.filter(value => value.id !== userId).findIndex(value => value.id === player.id)];
            const shared = sharedDecks.find(deck => deck.playerId === player.id);
            const image = own ? artwork : shared?.image;
            return <li key={player.id} className={`preparation-seat seat-color-${index % 6} seat-position-${seat} ${own ? 'is-own' : ''}`}>
              <div className="preparation-card-back" aria-hidden="true">{image ? <img src={deckApi.imageURL(image)} alt="" onError={event => { event.currentTarget.src = '/library-back.png'; }} /> : <img src="/library-back.png" alt="" />}<span className="preparation-avatar">{player.name.slice(0, 1).toUpperCase()}</span></div>
              <div className="preparation-seat-copy"><strong>{player.name}{own && <small className="preparation-you"> · você</small>}</strong><small>{own ? selectedDeck?.name || 'Sem deck' : shared?.name || (player.deckId ? 'Deck selecionado' : 'Aguardando deck')}{own && selectedDeck ? ` · ${cardCount(selectedDeck.cards)} cartas` : ''}</small><span className={`preparation-ready ${player.ready ? 'is-ready' : ''}`}>{player.ready ? '✓ Pronto' : '✦ Preparando'}</span></div>
            </li>;
          })}{[0, 5, 1, 4, 2].slice(room.participants.length - 1, room.seats - 1).map(seat => <li className={`preparation-empty-seat seat-position-${seat}`} key={`empty-${seat}`} aria-label="Lugar livre"><span aria-hidden="true">＋</span> Lugar livre</li>)}</ul>
        </div>
        <div className="preparation-start">
          <div className="preparation-readiness"><span className="preparation-shields" aria-hidden="true">{room.participants.map((player,index)=><i key={player.id} className={`seat-color-${index % 6}`}>⬟</i>)}</span><p id="room-waiting" role="status"><b>{readyCount}/{room.participants.length} prontos</b> · {waiting.length ? `Ainda falta: ${waiting.map(value => value.name).join(', ')}.` : 'Todos prontos para começar.'}</p></div>
          {room.creatorId === userId ? <button className="secondary" disabled={rooms.busy || settingsPending || waiting.length > 0} aria-describedby="room-waiting" onClick={() => void rooms.start(room.id)}>Iniciar partida <span aria-hidden="true">→</span></button> : <small>Aguardando {room.participants.find(player => player.id === room.creatorId)?.name} iniciar.</small>}
        </div>
      </section>
      <PreparationRules room={room} editable={room.creatorId === userId} busy={rooms.busy} onPendingChange={setSettingsPending} onChange={settings => rooms.settings(room.id, settings)} onMulliganMode={mode => rooms.setMulliganMode(room.id, mode)} />
      <div className="preparation-sidebar">
      <aside className="preparation-controls" aria-label="Seu preparo">
        <p className="eyebrow">SEU LUGAR NA MESA</p><h3>Prepare seu deck</h3>
        {decks.error && <p role="alert" className="error">{decks.error}</p>}
        {!decks.loading && decks.decks.length === 0 && <p><a href="/#/decks">Importe um deck</a> e volte a esta sala para confirmar.</p>}
        <label htmlFor="room-deck">Deck para a partida</label>
        <select id="room-deck" value={deckId} disabled={decks.loading || rooms.busy || participant.ready} onChange={event => {
          const value = event.target.value;
          setDeckId(value);
          if (value) void rooms.selectDeck(room.id, Number(value));
        }}>
          <option value="">Selecione um deck</option>
          {decks.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
        </select>
        <div className="preparation-selected-deck" aria-label="Deck escolhido">
          <div className="preparation-selected-art" aria-hidden="true">{selectedDeck ? <img src={artwork ? deckApi.imageURL(artwork) : '/library-back.png'} alt="" onError={event => { event.currentTarget.src = '/library-back.png'; }} /> : <span className="preparation-empty-art">✧</span>}</div>
          <div className="preparation-selected-info">{selectedDeck ? <><span className="preparation-deck-label">DECK ESCOLHIDO</span><strong>{selectedDeck.name}</strong><small>{cardCount(selectedDeck.cards)} cartas{selectedDeck.colorIdentity ? ` · ${colorNames(selectedDeck.colorIdentity)}` : ''}</small>{selectedDeck.commander && <small>Comandante: {selectedDeck.commander}</small>}</> : <strong>Sem deck</strong>}</div>
        </div>
        {participant.ready
          ? <button className="secondary preparation-ready-action" disabled={rooms.busy} onClick={() => void rooms.unready(room.id)}>Desfazer prontidão</button>
          : <button className="preparation-ready-action" disabled={rooms.busy || !deckId} onClick={() => void rooms.ready(room.id)}>Estou pronto <span aria-hidden="true">→</span></button>}
        {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
      </aside>
      </div>
    </div>
  </section>;
}
