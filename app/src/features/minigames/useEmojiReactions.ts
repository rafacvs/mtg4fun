import { useEffect, useRef, useState } from 'react';
import { LiveRequestError } from '../live/liveClient';
import { useLiveChannel, useLiveClient } from '../live/LiveRoom';

export const emojiOptions = ['😂', '💀', '🔥', '😭', '🐷', '👀', '🐐', '🍅'];
export type EmojiDrop = { key: number; emoji: string; fromName: string; left: number; duration: number };

// Espelha o limite do servidor (emojiLimit): cada clique espera mais que o anterior.
const baseWaitMs = 200;
const waitGrowth = 1.35;
const maxWaitMs = 3000;
const restMs = 5000;
// O servidor conta de quando recebe; a folga evita uma recusa à toa.
const marginMs = 40;
// Esperas curtas não pedem aviso: o spam segue fluido, só um pouco mais lento.
const noticeMs = 800;
const maxDrops = 40;

export function useEmojiReactions() {
  const client = useLiveClient();
  const [drops, setDrops] = useState<EmojiDrop[]>([]);
  const [coolingUntil, setCoolingUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const nextKey = useRef(0);
  const streak = useRef(0);
  const lastFree = useRef(0);
  const cooling = coolingUntil > now;
  const waiting = cooling && coolingUntil - now >= noticeMs - 100;
  useEffect(() => {
    if (!coolingUntil) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= coolingUntil) { clearInterval(timer); setCoolingUntil(0); }
    }, 50);
    return () => clearInterval(timer);
  }, [coolingUntil]);

  useLiveChannel('emoji', message => {
    if (message.type !== 'fall' || document.visibilityState !== 'visible') return;
    const drop = { key: ++nextKey.current, emoji: message.data.emoji, fromName: message.data.fromName, left: 6 + Math.random() * 88, duration: 2800 + Math.random() * 1200 };
    setDrops(current => [...current, drop].slice(-maxDrops));
  });

  function cool(duration: number) {
    setNow(Date.now());
    setCoolingUntil(Date.now() + duration);
  }

  async function send(emoji: string) {
    if (cooling) return;
    setError('');
    if (Date.now() - lastFree.current >= restMs) streak.current = 0;
    const wait = Math.min(maxWaitMs, baseWaitMs * waitGrowth ** streak.current) + marginMs;
    streak.current += 1;
    lastFree.current = Date.now() + wait;
    cool(wait);
    try {
      await client.request('emoji', 'send', { emoji });
    } catch (e) {
      if (e instanceof LiveRequestError && e.retryAfterMs) { lastFree.current = Date.now() + e.retryAfterMs; cool(e.retryAfterMs + marginMs); }
      else {
        setCoolingUntil(0);
        setError(e instanceof Error ? e.message : 'Não foi possível enviar.');
      }
    }
  }

  return { drops, cooling, waiting, secondsLeft: Math.ceil(Math.max(0, coolingUntil - now) / 1000), error, send, remove: (key: number) => setDrops(current => current.filter(drop => drop.key !== key)) };
}
