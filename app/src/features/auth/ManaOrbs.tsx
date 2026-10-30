import { useEffect, useRef, useState } from 'react';
import surpriseImage from '../../assets/banza-surprise.png';
import './mana-orbs.css';

export function ManaOrbs() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void import('./manaScene').then(({ createManaScene }) => {
      if (!active || !canvas.current) return;
      try {
        dispose = createManaScene(canvas.current, () => { if (active) setReady(true); }, () => { if (active) setReady(false); }, () => { if (active) setSurpriseOpen(true); });
      } catch { if (active) setReady(false); }
    }).catch(() => { if (active) setReady(false); });
    return () => { active = false; dispose?.(); };
  }, []);
  useEffect(() => {
    if (surpriseOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!surpriseOpen && dialog.current?.open) dialog.current.close();
  }, [surpriseOpen]);

  return <>
    <div className={`mana-orbs ${ready ? 'is-ready' : ''}`}>
      <div className="mana-orbs-fallback" aria-hidden={ready}>{['white', 'blue', 'black', 'red'].map(color => <span key={color} className={`mana-orb-${color}`} />)}<button type="button" className="mana-orb-green" aria-label="Abrir surpresa da esfera verde" onClick={() => setSurpriseOpen(true)} /></div>
      <canvas ref={canvas} role="button" tabIndex={ready ? 0 : -1} aria-hidden={!ready} aria-label="Abrir surpresa da esfera verde" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSurpriseOpen(true); } }} />
    </div>
    <dialog ref={dialog} className="green-orb-dialog" aria-labelledby="green-orb-dialog-title" onCancel={event => { event.preventDefault(); setSurpriseOpen(false); }} onClose={() => setSurpriseOpen(false)} onClick={event => { if (event.target === event.currentTarget) setSurpriseOpen(false); }}>
      <div className="green-orb-dialog-header"><h2 id="green-orb-dialog-title">Hora do Banza</h2><button type="button" className="secondary" aria-label="Fechar surpresa" onClick={() => setSurpriseOpen(false)}>Fechar</button></div>
      <img src={surpriseImage} alt="Hora do Banza" />
    </dialog>
  </>;
}
