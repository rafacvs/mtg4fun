import { useEffect, useState } from 'react';
import { useLiveChannel } from '../live/LiveRoom';

export function useMatchShake() {
  const [shake, setShake] = useState(0);
  useLiveChannel('shake', message => {
    if (message.type === 'shake' && document.visibilityState === 'visible') setShake(value => value + 1);
  });
  useEffect(() => {
    if (!shake) return;
    const board = document.querySelector<HTMLElement>('.match-board');
    if (!board || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = board.animate([
      { transform: 'translate(0, 0)' }, { transform: 'translate(-7px, 3px)' },
      { transform: 'translate(7px, -3px)' }, { transform: 'translate(-6px, -2px)' },
      { transform: 'translate(6px, 2px)' }, { transform: 'translate(0, 0)' },
    ], { duration: 450, easing: 'ease-in-out' });
    return () => animation.cancel();
  }, [shake]);
}
