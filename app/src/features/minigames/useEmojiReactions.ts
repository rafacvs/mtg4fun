import { useEffect, useRef, useState } from 'react';
import { LiveRequestError } from '../live/liveClient';
import { useLiveChannel, useLiveClient } from '../live/LiveRoom';

export const emojiOptions = ['👍', '❤️', '😂', '😮', '🎉', '😢', '🔥', '💀'];
export type EmojiDrop = { key: number; emoji: string; fromName: string; left: number; duration: number };

// O servidor conta 2 s a partir de quando recebe; a folga evita uma recusa à toa.
const cooldownMs = 2100;
const maxDrops = 40;

export function useEmojiReactions() {
  const client = useLiveClient();
  const [drops, setDrops] = useState<EmojiDrop[]>([]);
  const [cooling, setCooling] = useState(false);
  const [error, setError] = useState('');
  const nextKey = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useLiveChannel('emoji', message => {
    if (message.type !== 'fall' || document.visibilityState !== 'visible') return;
    const drop = { key: ++nextKey.current, emoji: message.data.emoji, fromName: message.data.fromName, left: 6 + Math.random() * 88, duration: 2800 + Math.random() * 1200 };
    setDrops(current => [...current, drop].slice(-maxDrops));
  });

  function cool(duration: number) {
    setCooling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCooling(false), duration);
  }

  async function send(emoji: string) {
    if (cooling) return;
    setError('');
    cool(cooldownMs);
    try {
      await client.request('emoji', 'send', { emoji });
    } catch (e) {
      if (e instanceof LiveRequestError && e.retryAfterMs) cool(e.retryAfterMs);
      else {
        setCooling(false);
        setError(e instanceof Error ? e.message : 'Não foi possível enviar.');
      }
    }
  }

  return { drops, cooling, error, send, remove: (key: number) => setDrops(current => current.filter(drop => drop.key !== key)) };
}
