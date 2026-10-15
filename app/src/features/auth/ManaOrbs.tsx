import { useEffect, useRef, useState } from 'react';
import './mana-orbs.css';

export function ManaOrbs() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void import('./manaScene').then(({ createManaScene }) => {
      if (!active || !canvas.current) return;
      try {
        dispose = createManaScene(canvas.current, () => { if (active) setReady(true); }, () => { if (active) setReady(false); });
      } catch { if (active) setReady(false); }
    }).catch(() => { if (active) setReady(false); });
    return () => { active = false; dispose?.(); };
  }, []);

  return <div className={`mana-orbs ${ready ? 'is-ready' : ''}`} aria-hidden="true">
    <div className="mana-orbs-fallback">{['white', 'blue', 'black', 'red', 'green'].map(color => <span key={color} className={`mana-orb-${color}`} />)}</div>
    <canvas ref={canvas} />
  </div>;
}
