import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { playerMark } from '../rooms/playerIdentity';
import { TableIcon } from '../rooms/TableIcon';
import type { Duels } from './CoinDuelLayer';

// Abre colado no assento clicado, para baixo ou, sem espaço, para cima.
export function ChallengeMenu({ target, seat, duels }: { target: NonNullable<Duels['target']>; seat: number; duels: Duels }) {
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; caret: number; above: boolean } | null>(null);
  useLayoutEffect(() => {
    const position = () => {
      if (!menu.current) return;
      const box = menu.current.getBoundingClientRect();
      const origin = target.anchor?.getBoundingClientRect();
      if (!origin) { setPlace({ left: (innerWidth - box.width) / 2, top: (innerHeight - box.height) / 2, caret: -1, above: false }); return; }
      const center = origin.left + origin.width / 2;
      const left = Math.max(12, Math.min(center - box.width / 2, innerWidth - box.width - 12));
      const above = origin.bottom + 10 + box.height > innerHeight - 12;
      setPlace({ left, top: above ? origin.top - box.height - 10 : origin.bottom + 10, caret: center - left, above });
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [target.anchor]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) duels.dismiss(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') duels.dismiss(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  });
  return <div ref={menu} role="dialog" aria-label={`Desafiar ${target.name}`} className={`duel-menu seat-color-${seat} ${place?.above ? 'is-above' : ''}`} style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden', '--caret': place && place.caret >= 0 ? `${place.caret}px` : undefined } as CSSProperties}>
    <header><span className="dice-player-shield" aria-hidden="true">{playerMark(target.name)}</span><div><p>Desafiar pra um X1</p><h2>{target.name}</h2></div><button type="button" className="duel-close" aria-label="Fechar desafio" onClick={duels.dismiss}><TableIcon name="close" /></button></header>
    <button type="button" className="duel-menu-game" disabled={duels.pending} onClick={() => void duels.challenge(target.id)}>
      <span className="duel-coin-mini is-large" aria-hidden="true"><TableIcon name="crown" /></span>
      <span><strong>Cara ou coroa</strong><small>Cada um escolhe um lado. A moeda decide quem passa vergonha.</small></span>
      <TableIcon name="chevron" />
    </button>
    {duels.error && <p role="alert" className="duel-error">{duels.error}</p>}
    <p className="duel-menu-note"><TableIcon name="clock" />Quem perder fica marcado na mesa até a partida começar.</p>
  </div>;
}
