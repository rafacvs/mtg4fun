import { useEffect, useState } from 'react';
import type { useDecks } from '../decks/useDecks';
import { MatchBoard } from './MatchBoard';
import { useRooms } from './useRooms';
import { roomsApi } from './roomsApi';

type Props = { roomId: number; userId: number; decks: ReturnType<typeof useDecks> };

export function RoomScreen({ roomId, userId, decks }: Props) {
  const rooms = useRooms();
  const [deckId, setDeckId] = useState('');
  const room = rooms.rooms.find(value => value.id === roomId);
  const participant = room?.participants.find(value => value.id === userId);
  useEffect(() => {
    if (participant?.deckId) setDeckId(String(participant.deckId));
  }, [participant?.deckId]);
  if (rooms.loading) return <p role="status">{rooms.connection}</p>;
  if (!room) return <MissingRoom roomId={roomId} />;
  if (!participant) return <section aria-label="Entrada na sala">
    <h2>{room.title}</h2>
    <p>{room.status === 'started' ? 'Esta partida já começou. Apenas os participantes podem entrar.' : 'Entre na sala para preparar seu deck.'}</p>
    {room.status === 'preparing' && <button disabled={rooms.busy || room.vacancies === 0} onClick={() => void rooms.join(roomId)}>Entrar na sala</button>}
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
  </section>;
  if (room.status === 'started') return <MatchBoard roomId={roomId} />;
  const waiting = room.participants.filter(value => !value.ready);
  return <section className="room-preparation" aria-label="Preparação da sala">
    <p className="eyebrow">PREPARAÇÃO</p><h2>{room.title}</h2>
    <p>Escolha um deck. O criador pode iniciar quando todos estiverem prontos.</p>
    <ul>{room.participants.map(value => <li key={value.id}>{value.name} · {value.ready ? 'Pronto' : 'Escolhendo deck'}</li>)}</ul>
    <fieldset className="mulligan-mode"><legend>Tipo de mulligan</legend>
      <label><input type="radio" name="mulligan-mode" value="standard" checked={room.mulliganMode === 'standard'} disabled={room.creatorId !== userId || rooms.busy} onChange={() => void rooms.setMulliganMode(roomId, 'standard')} /> Padrão</label>
      <small>Primeiro gratuito; ao manter, coloque no fundo uma carta por mulligan adicional.</small>
      <label><input type="radio" name="mulligan-mode" value="aconchegaz" checked={room.mulliganMode === 'aconchegaz'} disabled={room.creatorId !== userId || rooms.busy} onChange={() => void rooms.setMulliganMode(roomId, 'aconchegaz')} /> Aconchegaz</label>
      <small>Sempre embaralhe a mão e compre sete novas cartas, sem redução.</small>
    </fieldset>
    {decks.error && <p role="alert" className="error">{decks.error}</p>}
    {!decks.loading && decks.decks.length === 0 && <p><a href="/#/decks">Importe um deck</a> e volte a esta sala para confirmar.</p>}
    <label htmlFor="room-deck">Deck para a partida</label>
    <select id="room-deck" value={deckId} disabled={decks.loading || rooms.busy || participant.ready} onChange={event => {
      const value = event.target.value;
      setDeckId(value);
      if (value) void rooms.selectDeck(roomId, Number(value));
    }}>
      <option value="">Selecione um deck</option>
      {decks.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
    </select>
    {participant.ready
      ? <button disabled={rooms.busy} onClick={() => void rooms.unready(roomId)}>Desfazer prontidão</button>
      : <button disabled={rooms.busy || !deckId} onClick={() => void rooms.ready(roomId)}>Estou pronto</button>}
    {room.creatorId === userId && <button className="secondary" disabled={rooms.busy || waiting.length > 0} aria-describedby="room-waiting" onClick={() => void rooms.start(roomId)}>Iniciar partida</button>}
    <p id="room-waiting" role="status">{waiting.length ? `Ainda falta: ${waiting.map(value => value.name).join(", ")}.` : "Todos prontos para começar."}</p>
    {rooms.error && <p role="alert" className="error">{rooms.error}</p>}
  </section>;
}

function MissingRoom({ roomId }: { roomId: number }) {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    setChecking(true);
    void roomsApi.match(roomId).then(match => {
      if (active && match.finished) window.location.hash = '/salas';
    }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [roomId]);
  return <p role={checking ? 'status' : 'alert'}>{checking ? 'Verificando sala…' : 'Sala não encontrada.'}</p>;
}
