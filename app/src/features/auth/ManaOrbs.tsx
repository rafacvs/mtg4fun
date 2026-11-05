import { useEffect, useRef, useState } from 'react';
import surpriseImage from '../../assets/banza-surprise.png';
import blueSurpriseImage from '../../assets/contra-magias-surprise.png';
import './mana-orbs.css';

export function ManaOrbs() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false);
  const [surprise, setSurprise] = useState<'green' | 'blue' | null>(null);
  const title = surprise === 'blue' ? 'EU TENHO RESPOSTA RWSRRSSRRS' : 'Hora do Banza';
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void import('./manaScene').then(({ createManaScene }) => {
      if (!active || !canvas.current) return;
      try {
        dispose = createManaScene(canvas.current, () => { if (active) setReady(true); }, () => { if (active) setReady(false); }, () => { if (active) setSurprise('green'); }, () => { if (active) setSurprise('blue'); });
      } catch { if (active) setReady(false); }
    }).catch(() => { if (active) setReady(false); });
    return () => { active = false; dispose?.(); };
  }, []);
  useEffect(() => {
    if (surprise && !dialog.current?.open) dialog.current?.showModal();
    if (!surprise && dialog.current?.open) dialog.current.close();
  }, [surprise]);

  return <>
    <div className={`mana-orbs ${ready ? 'is-ready' : ''}`}>
      <div className="mana-orbs-fallback" aria-hidden={ready}>
        {['white', 'black', 'red'].map(color => <span key={color} className={`mana-orb-${color}`} />)}
        <button type="button" className="mana-orb-green" aria-label="Abrir surpresa da esfera verde" onClick={() => setSurprise('green')} />
        <button type="button" className="mana-orb-blue" aria-label="Abrir surpresa da esfera azul" onClick={() => setSurprise('blue')} />
      </div>
      <canvas ref={canvas} role="button" tabIndex={ready ? 0 : -1} aria-hidden={!ready} aria-label="Abrir surpresa da esfera verde" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSurprise('green'); } }} />
      {ready && <button type="button" className="mana-orb-keyboard" aria-label="Abrir surpresa da esfera azul" onClick={() => setSurprise('blue')}>Abrir surpresa da esfera azul</button>}
    </div>
    <dialog ref={dialog} className="mana-orb-dialog" aria-labelledby="mana-orb-dialog-title" onCancel={event => { event.preventDefault(); setSurprise(null); }} onClose={() => { if (!dialog.current?.open) setSurprise(null); }} onClick={event => { if (event.target === event.currentTarget) setSurprise(null); }}>
      <div className="mana-orb-dialog-header"><h2 id="mana-orb-dialog-title">{title}</h2><button type="button" className="secondary" aria-label="Fechar surpresa" onClick={() => setSurprise(null)}>Fechar</button></div>
      {surprise && <img key={surprise} src={surprise === 'blue' ? blueSurpriseImage : surpriseImage} alt={surprise === 'blue' ? 'Contra Magias' : 'Hora do Banza'} />}
    </dialog>
  </>;
}
