import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLiveClient } from '../live/LiveRoom';
import { seatColors } from './PlayerSeat';
import type { Match } from './roomsApi';
import './match-chat.css';

type Message = { id: number; authorId: number; author: string; body: string; createdAt: string };
type ChatShortcut = CustomEvent<{ action: 'open' | 'hold' | 'release' }>;

export function MatchChat({ match }: { match: Match }) {
  const [mode, setMode] = useState<'closed' | 'compose' | 'history'>('closed');
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const latestLoad = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const abortLoad = useRef<AbortController | null>(null);
  const savedScroll = useRef(0);
  const modeBeforeHold = useRef<'closed' | 'compose'>('closed');
  const stickToBottom = useRef(true);
  const client = useLiveClient();
  const path = `/api/rooms/${match.roomId}/match/chat`;

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const requestId = ++latestLoad.current;
    const controller = new AbortController();
    abortLoad.current = controller;
    const request = async () => {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error('Não foi possível carregar o chat.');
      const data = await response.json() as { messages: Message[] };
      if (requestId === latestLoad.current) setMessages(data.messages);
    };
    const pending = request();
    const shared = pending.finally(() => {
      if (inFlight.current === shared) inFlight.current = null;
      if (abortLoad.current === controller) abortLoad.current = null;
    });
    inFlight.current = shared;
    return shared;
  }, [path]);

  useEffect(() => {
    if (mode === 'closed') return;
    let active = true;
    let timer = 0;
    const load = async () => {
      try { await refresh(); if (active) setError(''); }
      catch { if (active) setError('Não foi possível carregar o chat.'); }
      finally { if (active) timer = window.setTimeout(() => void load(), 1000); }
    };
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
      latestLoad.current += 1;
      abortLoad.current?.abort();
      abortLoad.current = null;
      inFlight.current = null;
    };
  }, [mode, refresh]);

  useEffect(() => {
    if (!list.current) return;
    if (stickToBottom.current) list.current.scrollTop = list.current.scrollHeight;
    else list.current.scrollTop = savedScroll.current;
  }, [messages, mode]);

  useEffect(() => {
    const shortcut = (event: Event) => {
      const action = (event as ChatShortcut).detail?.action;
      if (action === 'open') setMode('compose');
      if (action === 'hold') setMode(current => { modeBeforeHold.current = current === 'history' ? 'closed' : current; return 'history'; });
      if (action === 'release') setMode(current => current === 'history' ? modeBeforeHold.current : current);
    };
    document.addEventListener('mtg4fun:chat-shortcut', shortcut);
    return () => document.removeEventListener('mtg4fun:chat-shortcut', shortcut);
  }, []);

  useEffect(() => { if (mode === 'compose') input.current?.focus(); }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = input.current?.value ?? body;
    if (!text.trim() || busy) { if (!text.trim()) setMode('closed'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || 'Não foi possível enviar a mensagem.');
      setBody('');
      stickToBottom.current = true;
      void refresh().catch(() => setError('Mensagem enviada, mas não foi possível atualizar o histórico.'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a mensagem.'); }
    finally { setBusy(false); }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') { event.preventDefault(); setMode('closed'); return; }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!event.currentTarget.value.trim()) setMode('closed');
      else event.currentTarget.form?.requestSubmit();
    }
  }

  async function shake() {
    setError('');
    try { await client.request('shake', 'send'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível chamar atenção.'); }
  }

  if (mode === 'closed') return <button type="button" className="chat-open-button secondary" onClick={() => setMode('compose')} aria-label="Abrir chat" title="Abrir chat (Z)">Chat</button>;
  return <section className={`match-chat match-chat-overlay ${mode === 'history' ? 'is-history-only' : 'is-composing'}`} aria-label="Chat da partida">
    <header className="chat-overlay-header"><strong>Chat da partida</strong><button type="button" className="secondary" onClick={() => setMode('closed')} aria-label="Fechar chat">×</button></header>
    <div className="chat-messages" ref={list} aria-label="Mensagens" onScroll={event => {
      const node = event.currentTarget;
      stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 36;
    }}>
      {messages.length === 0 && <p className="log-empty">Nenhuma mensagem ainda.</p>}
      {messages.map(message => {
        const index = match.players.findIndex(player => player.userId === message.authorId);
        const date = new Date(message.createdAt);
        return <div className="chat-message" key={message.id}>
          <strong style={{ color: index < 0 ? undefined : seatColors[index % seatColors.length] }}>{message.author}</strong>
          <time dateTime={message.createdAt}>{Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
          <span>{message.body}</span>
        </div>;
      })}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {mode === 'compose' && <form onSubmit={event => void submit(event)} className="chat-form">
      <label className="chat-input-label"><span className="visually-hidden">Mensagem</span><textarea ref={input} aria-label="Mensagem" value={body} maxLength={1000} rows={2} onChange={event => setBody(event.target.value)} onKeyDown={onInputKeyDown} placeholder="Escreva uma mensagem" /></label>
      <div className="chat-actions"><button type="button" className="secondary" onClick={() => void shake()}>Chamar atenção</button><button type="submit" disabled={busy || !body.trim()}>Enviar</button></div>
    </form>}
  </section>;
}
