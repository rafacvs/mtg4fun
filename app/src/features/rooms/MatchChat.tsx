import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLiveClient } from '../live/LiveRoom';
import { seatColors } from './PlayerSeat';
import type { Match } from './roomsApi';
import './match-chat.css';

type Message = { id: number; authorId: number; author: string; body: string; createdAt: string };

export function MatchChat({ match }: { match: Match }) {
  const roomId = match.roomId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const client = useLiveClient();
  const path = `/api/rooms/${roomId}/match/chat`;
  async function refresh() {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Não foi possível carregar o chat.');
    const data = await response.json() as { messages: Message[] };
    setMessages(data.messages);
  }
  useEffect(() => {
    let active = true;
    const load = () => { void refresh().catch(() => { if (active) setError('Não foi possível carregar o chat.'); }); };
    load();
    const timer = window.setInterval(load, 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível enviar a mensagem.');
      setBody(''); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a mensagem.'); }
    finally { setBusy(false); }
  }
  async function shake() {
    setError('');
    try { await client.request('shake', 'send'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível chamar atenção.'); }
  }
  return <section className="match-chat" aria-label="Chat da partida">
    <div className="chat-messages" aria-label="Mensagens">
      {messages.length === 0 && <p className="log-empty">Nenhuma mensagem ainda.</p>}
      {messages.map(message => {
        const index = match.players.findIndex(player => player.userId === message.authorId);
        return <div className="chat-message" key={message.id}><strong style={{ color: index < 0 ? undefined : seatColors[index % seatColors.length] }}>{message.author}</strong><span>{message.body}</span></div>;
      })}
      <div ref={end} />
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <form onSubmit={event => void submit(event)} className="chat-form">
      <label className="chat-input-label">Mensagem<textarea value={body} maxLength={1000} rows={2} onChange={event => setBody(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }} placeholder="Escreva uma mensagem" /></label>
      <div className="chat-actions"><button type="button" className="secondary" onClick={() => void shake()}>Chamar atenção</button><button type="submit" disabled={busy || !body.trim()}>Enviar</button></div>
    </form>
  </section>;
}
