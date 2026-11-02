import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveRequestError } from '../live/liveClient';
import { useLiveChannel, useLiveClient } from '../live/LiveRoom';

export const pinnedEmojis = ['😂', '💀', '🔥', '😭', '🐷', '👀', '🐐', '🍅'];
export type EmojiDrop = { key: number; emoji: string; fromName: string; left: number; duration: number };
// x e y deslocam o impacto em % da carta; turn gira o respingo, para nenhum cair igual ao outro.
export type TomatoSplat = { key: number; card: HTMLElement; fromName: string; x: number; y: number; turn: number };

// Espelha o limite do servidor (emojiLimit): cada clique espera mais que o anterior.
const baseWaitMs = 120;
const waitGrowth = 1.12;
const maxWaitMs = 1200;
const restMs = 3000;
// O servidor conta de quando recebe; a folga evita uma recusa à toa.
const marginMs = 40;
// Esperas curtas não pedem aviso: o spam segue fluido, só um pouco mais lento.
const noticeMs = 800;
const maxDrops = 40;
const maxSplats = 12;

// Só cartas no campo levam tomate: são as únicas que todos veem no mesmo lugar.
export function tableCard(cardId: string) {
  return document.querySelector<HTMLElement>(`.zone-battlefield [data-card-id="${CSS.escape(cardId)}"]`);
}

export function useEmojiReactions() {
  const client = useLiveClient();
  const [drops, setDrops] = useState<EmojiDrop[]>([]);
  const [splats, setSplats] = useState<TomatoSplat[]>([]);
  const [coolingUntil, setCoolingUntil] = useState(0);
  const [coolingFor, setCoolingFor] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const nextKey = useRef(0);
  const streak = useRef(0);
  const lastFree = useRef(0);
  const remove = useCallback((key: number) => setDrops(current => current.filter(drop => drop.key !== key)), []);
  const clean = useCallback((key: number) => setSplats(current => current.filter(splat => splat.key !== key)), []);
  const cooling = coolingUntil > now;
  // O aviso vale para a espera inteira, não só para o começo dela.
  const waiting = cooling && coolingFor >= noticeMs - 100;
  useEffect(() => {
    if (!coolingUntil) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= coolingUntil) { clearInterval(timer); setCoolingUntil(0); }
    }, 50);
    return () => clearInterval(timer);
  }, [coolingUntil]);

  useLiveChannel('emoji', message => {
    if (document.visibilityState !== 'visible') return;
    if (message.type === 'fall') {
      const drop = { key: ++nextKey.current, emoji: message.data.emoji, fromName: message.data.fromName, left: 6 + Math.random() * 88, duration: 2800 + Math.random() * 1200 };
      setDrops(current => [...current, drop].slice(-maxDrops));
    }
    if (message.type === 'splat') {
      const card = tableCard(message.data.cardId);
      if (card) setSplats(current => [...current, { key: ++nextKey.current, card, fromName: message.data.fromName, x: (Math.random() - .5) * 40, y: (Math.random() - .5) * 36, turn: Math.random() * 360 }].slice(-maxSplats));
    }
  });

  function cool(duration: number) {
    setNow(Date.now());
    setCoolingFor(duration);
    setCoolingUntil(Date.now() + duration);
  }

  async function request(type: 'send' | 'throw', data: object) {
    if (cooling) return;
    setError('');
    if (Date.now() - lastFree.current >= restMs) streak.current = 0;
    const wait = Math.min(maxWaitMs, baseWaitMs * waitGrowth ** streak.current) + marginMs;
    streak.current += 1;
    lastFree.current = Date.now() + wait;
    cool(wait);
    try {
      await client.request('emoji', type, data);
    } catch (e) {
      if (e instanceof LiveRequestError && e.retryAfterMs) { lastFree.current = Date.now() + e.retryAfterMs; cool(e.retryAfterMs + marginMs); }
      else {
        setCoolingUntil(0);
        setError(e instanceof Error ? e.message : 'Não foi possível enviar.');
      }
    }
  }

  return {
    drops, splats, cooling, waiting, error, setError,
    secondsLeft: Math.ceil(Math.max(0, coolingUntil - now) / 1000),
    send: (emoji: string) => request('send', { emoji }),
    throwTomato: (cardId: string) => request('throw', { cardId }),
    remove, clean,
  };
}
