export type LiveMessage<Data = unknown> = { game: string; type: string; id?: string; data?: Data };
export type LiveStatus = 'connecting' | 'open' | 'reconnecting' | 'ended';
type Handler = (message: LiveMessage) => void;
type Pending = { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

const sessionExpired = 4401;
const requestTimeoutMs = 8000;
const maxRetryMs = 15000;

export class LiveRequestError extends Error {
  constructor(message: string, readonly retryAfterMs = 0) { super(message); }
}

// Conexão genérica de uma sala. Os jogos assinam pelo nome e recebem o `snapshot`
// ao conectar e depois suas mensagens; `state` é sempre o estado completo do jogo.
// O servidor não reenvia o que passou: ao voltar, só chega o estado atual.
export class LiveClient {
  status: LiveStatus = 'connecting';
  private socket: WebSocket | null = null;
  private running = false;
  private attempts = 0;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private nextId = 0;
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly latest = new Map<string, LiveMessage>();
  private readonly pending = new Map<string, Pending>();
  private readonly statusListeners = new Set<() => void>();

  constructor(private readonly url: string) {}

  start() {
    this.running = true;
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    this.connect();
  }

  stop() {
    this.running = false;
    clearTimeout(this.retry);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    this.socket?.close();
    this.socket = null;
    this.failPending();
  }

  // Quem assina depois de conectar recebe o último estado conhecido do jogo.
  subscribe(game: string, handler: Handler) {
    const handlers = this.handlers.get(game) ?? new Set<Handler>();
    this.handlers.set(game, handlers);
    handlers.add(handler);
    const latest = this.latest.get(game);
    if (latest) handler({ ...latest, type: 'snapshot' });
    return () => { handlers.delete(handler); };
  }

  subscribeStatus = (listener: () => void) => {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  };

  request(game: string, type: string, data: unknown = {}) {
    return new Promise<void>((resolve, reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) { reject(new LiveRequestError('Sem conexão com a sala. Tente novamente.')); return; }
      const id = String(++this.nextId);
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new LiveRequestError('A sala não respondeu. Tente novamente.'));
      }, requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ game, type, id, data }));
    });
  }

  private wake = () => {
    if (!this.running || document.visibilityState !== 'visible' || this.socket) return;
    clearTimeout(this.retry);
    this.connect();
  };

  private connect() {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => { this.attempts = 0; this.setStatus('open'); };
    socket.onmessage = event => this.receive(JSON.parse(event.data));
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.failPending();
      if (event.code === sessionExpired) { this.running = false; this.setStatus('ended'); return; }
      this.setStatus('reconnecting');
      const wait = Math.min(maxRetryMs, 500 * 2 ** this.attempts++);
      this.retry = setTimeout(() => this.connect(), wait / 2 + Math.random() * wait / 2);
    };
  }

  private receive(message: LiveMessage) {
    if (message.type === 'ack' || message.type === 'error') {
      const pending = this.pending.get(message.id ?? '');
      if (!pending) return;
      this.pending.delete(message.id!);
      clearTimeout(pending.timer);
      if (message.type === 'ack') pending.resolve();
      else {
        const detail = message.data as { message: string; retryAfterMs?: number };
        pending.reject(new LiveRequestError(detail.message, detail.retryAfterMs));
      }
      return;
    }
    if (message.type === 'snapshot' || message.type === 'state') this.latest.set(message.game, message);
    this.handlers.get(message.game)?.forEach(handler => handler(message));
  }

  private failPending() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new LiveRequestError('A conexão com a sala caiu. Tente novamente.'));
    }
    this.pending.clear();
  }

  private setStatus(status: LiveStatus) {
    this.status = status;
    this.statusListeners.forEach(listener => listener());
  }
}
