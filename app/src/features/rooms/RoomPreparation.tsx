import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { deckApi, type Deck } from '../decks/deckApi';
import { DeckEditorDialog } from '../decks/DeckEditorDialog';
import { DeckImportDialog } from '../decks/DeckImportDialog';
import { DuelResultBanner } from '../minigames/DuelResultBanner';
import { playerMark, deckArt } from './playerIdentity';
import { TableIcon } from './TableIcon';
import { cardCount } from '../decks/deckDisplay';
import type { useDecks } from '../decks/useDecks';
import type { Room } from './roomsApi';
import type { useRooms } from './useRooms';
import { PanelCorners } from './PanelCorners';
import { PreparationRules } from './PreparationRules';
import { DeckEditButton } from './DeckEditButton';
import { MobilePreparation } from './MobilePreparation';
import { CoinDuelLayer } from '../minigames/CoinDuelLayer';
import { EmojiBar } from '../minigames/EmojiBar';
import { useCoinDuels } from '../minigames/useCoinDuels';
import './room-preparation.css';
import './mobile-preparation.css';
import './preparation-deck-tools.css';

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
  const [sharedDecks, setSharedDecks] = useState<{ playerId: number; name: string; image?: string; colors?: string; cards?: number }[]>([]);
  const deckSelection = room.participants.map(player => `${player.id}:${player.deckId ?? 0}:${player.deckRevision ?? 0}`).join(',');
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
  const duels = useCoinDuels(userId);
  const colorOf = (playerId: number) => sharedDecks.find(deck => deck.playerId === playerId)?.colors;
  const seatOf = (playerId: number) => room.participants.findIndex(player => player.id === playerId) % 6;
  const [deckDialog, setDeckDialog] = useState<'import' | 'edit' | null>(null);
  // O pronto trava o deck, e um dialog modal ficaria por cima do X1 recebido.
  useEffect(() => { if (participant.ready || duels.panelOpen) setDeckDialog(null); }, [participant.ready, duels.panelOpen]);
  const selectImportedDeck = (deck: Deck) => {
    setDeckId(String(deck.id));
    void rooms.selectDeck(room.id, deck.id).then(ok => { if (!ok) setDeckId(participant.deckId ? String(participant.deckId) : ''); });
  };
  const deckDialogs = <>
    <DeckImportDialog open={deckDialog === 'import'} library={decks} onClose={() => setDeckDialog(null)} onImported={selectImportedDeck} />
    <DeckEditorDialog deck={selectedDeck} open={deckDialog === 'edit' && Boolean(selectedDeck)} library={decks} onClose={() => setDeckDialog(null)} />
  </>;
  const minigames = <CoinDuelLayer duels={duels} userId={userId} artOf={playerId => deckArt(colorOf(playerId))} seatOf={seatOf} />;
  if (mobile) return <><MobilePreparation room={room} participant={participant} userId={userId} deckId={deckId} setDeckId={setDeckId} decks={decks} rooms={rooms} sharedDecks={sharedDecks} onChallenge={duels.prepare} interrupted={!!duels.panelOpen} emoji={<EmojiBar />} marks={duels.marks} deckErrorHidden={deckDialog !== null} onImportDeck={() => setDeckDialog('import')} onEditDeck={() => setDeckDialog('edit')} />{deckDialogs}{minigames}<DuelResultBanner outcome={duels.banner} seatOf={seatOf} /></>;
  return <><section className="room-preparation" aria-label="Preparação da sala">
    <div className="preparation-content">
      <section className="preparation-table" aria-label="Jogadores à mesa">
        <PanelCorners />
        <header className="preparation-heading">
          <div><p className="eyebrow">A MESA ESTÁ SE FORMANDO</p><h2>À mesa</h2></div>
          <div className="preparation-room-facts"><span><TableIcon name="crown" />{room.format || 'Mesa'}</span><span><TableIcon name="heart" /><b>{room.life}</b> de vida</span><span><i className="facts-shield" aria-hidden="true" /><b>{room.participants.length}/{room.seats}</b> jogadores</span></div>
        </header>
        <div className="preparation-arena">
          <div className="preparation-oval" aria-hidden="true">{room.participants.filter(player => player.deckId).map(player => { const others = room.participants.filter(value => value.id !== userId); const position = player.id === userId ? 2 : [0, 1, 3, 5, 4][others.findIndex(value => value.id === player.id)]; return <img key={player.id} className={`preparation-pile preparation-pile-${position}`} src="/library-back.png" alt="" />; })}<div className="preparation-oval-center"><strong>{readyCount}/{room.participants.length}</strong><span>PRONTOS</span></div></div>
          <ul className="preparation-seats">{[...room.participants.filter(player => player.id !== userId), participant].map(player => {
            const index = room.participants.findIndex(value => value.id === player.id);
            const own = player.id === userId;
            const seat = own ? 3 : [0, 5, 1, 4, 2][room.participants.filter(value => value.id !== userId).findIndex(value => value.id === player.id)];
            const shared = sharedDecks.find(deck => deck.playerId === player.id);
            const deckLabel = own ? selectedDeck?.name || 'Sem deck' : shared?.name || (player.deckId ? 'Deck selecionado' : 'Aguardando deck');
            const cards = own ? (selectedDeck ? cardCount(selectedDeck.cards) : 0) : shared?.cards;
            const mark = duels.marks[player.id];
            return <li key={player.id} className={`preparation-seat seat-color-${index % 6} seat-position-${seat} ${own ? 'is-own' : ''} ${duels.target?.id === player.id ? 'is-challenged' : ''}`}>
              <div className="preparation-card-back" aria-hidden="true"><img src={deckArt(shared?.colors ?? (own ? selectedDeck?.colorIdentity : undefined))} alt="" /><span className="preparation-avatar">{playerMark(player.name)}</span></div>
              <div className="preparation-seat-copy"><strong>{player.name}{player.id === room.creatorId && <i className="seat-creator" title="Criou a sala"><TableIcon name="crown" /></i>}{own && <small className="preparation-you"> você</small>}</strong><small>{deckLabel}{cards ? ` · ${cards} cartas` : ''}</small><span className={`preparation-ready ${player.ready ? 'is-ready' : ''}`}>{player.ready ? '✓ Pronto' : '✦ Preparando'}</span>{mark && <span className="preparation-duel-mark"><i aria-hidden="true" />{mark === 'refused' ? 'Recusou o X1' : 'Perdeu no X1'}</span>}</div>
              {!own && <button type="button" className="coin-duel-seat" aria-label={`Desafiar ${player.name} para um X1`} title="Desafiar para um X1" onClick={event => duels.prepare(player, event.currentTarget.parentElement)} />}
            </li>;
          })}{[0, 5, 1, 4, 2].slice(room.participants.length - 1, room.seats - 1).map(seat => <li className={`preparation-empty-seat seat-position-${seat}`} key={`empty-${seat}`} aria-label="Lugar livre"><span aria-hidden="true">＋</span> Lugar livre</li>)}</ul>
          <DuelResultBanner outcome={duels.banner} seatOf={seatOf} />
        </div>
        <div className="preparation-start">
          <div className="preparation-readiness"><span className="preparation-shields" aria-label="Jogadores da mesa">{room.participants.map((player,index)=><span key={player.id} className={`dice-player-shield seat-color-${index % 6} ${player.ready ? 'is-ready' : ''}`} title={`${player.name}: ${player.ready ? 'pronto' : 'ainda não está pronto'}`} role="img" aria-label={`${player.name}: ${player.ready ? 'pronto' : 'ainda não está pronto'}`} />)}</span><p id="room-waiting" role="status"><b>{readyCount}/{room.participants.length} prontos</b>{waiting.length ? ` · Falta: ${waiting.map(value => value.name).join(', ')}` : ' · Todos prontos para começar.'}</p></div>
          <div className="preparation-table-actions"><EmojiBar /><div className="preparation-dice-action" />
          {room.creatorId === userId ? <button className="secondary" disabled={rooms.busy || settingsPending || waiting.length > 0} aria-describedby="room-waiting" onClick={() => void rooms.start(room.id)}>Iniciar partida <span aria-hidden="true">→</span></button> : <small>Aguardando {room.participants.find(player => player.id === room.creatorId)?.name} iniciar.</small>}
          </div>
        </div>
      </section>
      <PreparationRules room={room} editable={room.creatorId === userId} busy={rooms.busy} onPendingChange={setSettingsPending} onChange={settings => rooms.settings(room.id, settings)} onMulliganMode={mode => rooms.setMulliganMode(room.id, mode)} />
      <div className="preparation-sidebar">
      <aside className="preparation-controls" aria-label="Seu preparo">
        <PanelCorners />
        <p className="eyebrow">SEU LUGAR NA MESA</p><h3>Prepare seu deck</h3>
        {decks.error && deckDialog === null && <p role="alert" className="error">{decks.error}</p>}
        {!decks.loading && decks.decks.length === 0 && <p>Importe um deck para confirmar sua presença nesta sala.</p>}
        <div className="preparation-deck-field"><label htmlFor="room-deck">Deck para a partida</label><button type="button" className="secondary preparation-import-deck" disabled={decks.loading || decks.busy || participant.ready} onClick={() => setDeckDialog('import')}>Importar deck</button></div>
        <select id="room-deck" value={deckId} disabled={decks.loading || rooms.busy || participant.ready} onChange={event => {
          const value = event.target.value;
          setDeckId(value);
          if (value) void rooms.selectDeck(room.id, Number(value));
        }}>
          <option value="">Selecione um deck</option>
          {decks.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
        </select>
        <div className="preparation-selected-deck" aria-label="Deck escolhido" style={selectedDeck ? { '--deck-art': `url("${deckArt(colorOf(userId) ?? selectedDeck.colorIdentity)}")` } as CSSProperties : undefined}>
          <div className="preparation-selected-art" aria-hidden="true">{selectedDeck ? <img src={artwork ? deckApi.imageURL(artwork) : '/library-back.png'} alt="" onError={event => { event.currentTarget.src = '/library-back.png'; }} /> : <span className="preparation-empty-art">✧</span>}</div>
          <div className="preparation-selected-info">{selectedDeck ? <><span className="preparation-deck-label">DECK ESCOLHIDO</span><strong>{selectedDeck.name}</strong><small>{cardCount(selectedDeck.cards)} cartas</small>{selectedDeck.commander && <small>{selectedDeck.commander}</small>}</> : <strong>Sem deck</strong>}</div>
          {selectedDeck && !participant.ready && <DeckEditButton name={selectedDeck.name} onClick={() => setDeckDialog('edit')} />}
        </div>
        {participant.ready
          ? <button className="secondary preparation-ready-action" disabled={rooms.busy} onClick={() => void rooms.unready(room.id)}>Desfazer prontidão</button>
          : <button className="preparation-ready-action" disabled={rooms.busy || !deckId} onClick={() => void rooms.ready(room.id)}>Estou pronto <span aria-hidden="true">→</span></button>}
        {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
      </aside>
      </div>
    </div>
  </section>{deckDialogs}{minigames}</>;
}
