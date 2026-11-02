import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { TomatoSplat } from './useEmojiReactions';
import './tomato.css';

const cardSelector = '.zone-battlefield [data-card-id]';
const splatMs = 1900;

// Enquanto mira, a mesa inteira vira alvo: cada clique numa carta do campo taca
// um tomate, e só o botão direito (ou Esc) guarda a mira. Os eventos param aqui,
// antes de chegar às cartas, para não abrir nem arrastar nada.
// O hover também para: o zoom da carta não cobre o respingo.
const blocked = ['pointerdown', 'pointerup', 'pointerover', 'mousedown', 'mouseup', 'mouseover', 'dblclick'];

export function TomatoAim({ waitSeconds, onThrow, onCancel }: { waitSeconds: number; onThrow: (cardId: string) => void; onCancel: () => void }) {
  useEffect(() => {
    document.body.classList.add('tomato-aiming');
    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const click = (event: MouseEvent) => {
      block(event);
      const card = (event.target as Element | null)?.closest<HTMLElement>(cardSelector);
      if (card?.dataset.cardId) onThrow(card.dataset.cardId);
    };
    const cancel = (event: Event) => { block(event); onCancel(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(event); };
    const options = { capture: true };
    for (const kind of blocked) window.addEventListener(kind, block, options);
    window.addEventListener('click', click, options);
    window.addEventListener('contextmenu', cancel, options);
    window.addEventListener('keydown', escape, options);
    return () => {
      document.body.classList.remove('tomato-aiming');
      for (const kind of blocked) window.removeEventListener(kind, block, options);
      window.removeEventListener('click', click, options);
      window.removeEventListener('contextmenu', cancel, options);
      window.removeEventListener('keydown', escape, options);
    };
  }, [onThrow, onCancel]);
  return createPortal(<p className="tomato-aim-hint" role="status"><span aria-hidden="true">🍅</span> {waitSeconds ? `Calma… ${waitSeconds}s` : 'Clique nas cartas do campo para tacar tomates'} · Botão direito para parar</p>, document.body);
}

export function hasTableCards() {
  return Boolean(document.querySelector(cardSelector));
}

const drips = [
  { x: 33, y: 66, width: 5, length: 38, delay: 0 },
  { x: 46, y: 72, width: 6.500, length: 56, delay: 90 },
  { x: 59, y: 69, width: 4.500, length: 30, delay: 40 },
  { x: 69, y: 62, width: 5.500, length: 44, delay: 140 },
];

function Splat({ splat, onDone }: { splat: TomatoSplat; onDone: (key: number) => void }) {
  useEffect(() => {
    // O tranco usa `translate`, que não briga com o `transform` de carta virada.
    splat.card.animate?.([{ translate: '0 0' }, { translate: '-4px 2px' }, { translate: '3px -1px' }, { translate: '0 0' }], { duration: 240, delay: 100, easing: 'ease-out' });
    const timer = window.setTimeout(() => onDone(splat.key), splatMs + 200);
    return () => window.clearTimeout(timer);
  }, [splat, onDone]);
  const hit = { '--hit-x': `${splat.x}%`, '--hit-y': `${splat.y}%`, '--hit-turn': `${splat.turn}deg` } as CSSProperties;
  return createPortal(<span className="tomato-splat" aria-hidden="true" data-tomato-from={splat.fromName} style={hit}>
    <span className="tomato-flying">🍅</span>
    <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`tomato-pulp-${splat.key}`} cx="45%" cy="40%" r="60%"><stop offset="0" stopColor="#f04a2c" /><stop offset=".7" stopColor="#c81d14" /><stop offset="1" stopColor="#8d0f0a" /></radialGradient>
      </defs>
      <g className="tomato-drips" fill="#b9170f">
        {drips.map(drip => <g key={drip.x} style={{ '--drip-delay': `${drip.delay}ms` } as CSSProperties}>
          <rect x={drip.x} y={drip.y} width={drip.width} height={drip.length} rx={drip.width / 2} />
          <circle cx={drip.x + drip.width / 2} cy={drip.y + drip.length} r={drip.width * .72} />
        </g>)}
      </g>
      <g className="tomato-pulp">
        <path fill={`url(#tomato-pulp-${splat.key})`} d="M50 30C58 26 62 36 68 33 76 29 80 38 76 44 84 46 88 54 80 58 86 64 80 72 72 68 70 76 62 80 56 74 50 82 40 80 40 72 32 76 22 70 28 62 18 60 16 50 26 48 22 40 30 32 38 37 40 30 46 28 50 30Z" />
        <g fill="#c81d14"><circle cx="19" cy="35" r="3" /><circle cx="85" cy="37" r="2.500" /><circle cx="14" cy="66" r="2" /><circle cx="89" cy="71" r="3" /><circle cx="61" cy="21" r="2" /><circle cx="30" cy="86" r="1.800" /></g>
        <g fill="#f6d872"><ellipse cx="45" cy="50" rx="2" ry="1.200" transform="rotate(-25 45 50)" /><ellipse cx="57" cy="47" rx="2" ry="1.200" transform="rotate(30 57 47)" /><ellipse cx="52" cy="61" rx="2" ry="1.200" /><ellipse cx="63" cy="57" rx="2" ry="1.200" transform="rotate(60 63 57)" /><ellipse cx="38" cy="58" rx="2" ry="1.200" transform="rotate(-50 38 58)" /></g>
        <ellipse cx="44" cy="42" rx="7" ry="3" fill="#fff" opacity=".3" transform="rotate(-20 44 42)" />
      </g>
    </svg>
    <small>{splat.fromName}</small>
  </span>, splat.card);
}

export function TomatoSplats({ splats, onDone }: { splats: TomatoSplat[]; onDone: (key: number) => void }) {
  return <>{splats.map(splat => <Splat key={splat.key} splat={splat} onDone={onDone} />)}</>;
}
