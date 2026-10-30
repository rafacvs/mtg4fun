import type { CSSProperties } from 'react';
import { GameActionFooter } from './GameActionFooter';
import { LibraryCardBack } from './LibraryCardBack';
import { LibrarySection } from './LibraryMenu';
import { TableIcon, type TableIconName } from './TableIcon';

export type LibraryViewer = { userId: number; name: string; position: number; color: string };
type Source = 'top' | 'bottom';

type Props = {
  view: 'draw' | 'look' | 'reveal'; source: Source; count: number; libraryCount: number; busy: boolean; viewers: LibraryViewer[];
  onSource: (source: Source) => void; onCount: (count: number) => void; onBegin: () => void; onCancel: () => void;
};

const cardsLabel = (count: number) => count === 1 ? '1 carta' : count ? `${count} cartas` : 'cartas';

function CountStepper({ count, libraryCount, busy, onCount, large = false }: Pick<Props, 'count' | 'libraryCount' | 'busy' | 'onCount'> & { large?: boolean }) {
  return <div className={`library-count ${large ? 'library-count-large' : ''}`}>
    <button type="button" aria-label="Diminuir quantidade" disabled={busy || count <= 1} onClick={() => onCount(count - 1)}>−</button>
    <input type="number" aria-label="Quantidade de cartas" min="1" max={libraryCount} disabled={busy} value={count} onChange={event => onCount(Number(event.target.value))} />
    <button type="button" aria-label="Aumentar quantidade" disabled={busy || count >= libraryCount} onClick={() => onCount(count + 1)}>+</button>
  </div>;
}

function DrawScene({ count, libraryCount }: { count: number; libraryCount: number }) {
  const fan = Math.max(1, Math.min(count || 1, 5));
  return <div className="library-scene library-draw-scene" aria-hidden="true">
    <div className="library-scene-side">
      <div className="library-draw-pile"><span /><span /><LibraryCardBack /><b>{libraryCount}</b></div>
      <em>Grimório</em>
    </div>
    <svg className="library-draw-arrow" viewBox="0 0 90 44" fill="none"><path d="M3 40C18 12 50 2 84 19" stroke="#d8b768" strokeWidth="1.300" strokeDasharray="4 3.500" strokeLinecap="round" /><path d="m77 10 8 9-11 3" stroke="#d8b768" strokeWidth="1.300" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <div className="library-scene-side">
      <div className="library-draw-fan">{Array.from({ length: fan }, (_, index) => {
        const offset = index - (fan - 1) / 2;
        return <span key={index} style={{ '--fan-x': `${offset * 22}px`, '--fan-angle': `${offset * 9}deg` } as CSSProperties}><LibraryCardBack /></span>;
      })}</div>
      <em>Sua mão</em>
    </div>
  </div>;
}

function DepthDiagram({ source, count }: { source: Source; count: number }) {
  const lines = (total: number, highlighted: number, fromEnd: boolean) => Array.from({ length: total }, (_, index) => <i key={index} className={(fromEnd ? index >= total - highlighted : index < highlighted) ? 'picked' : ''} />);
  return <div className="library-depth" aria-hidden="true">
    <em className={source === 'top' ? 'picked' : ''}>Topo</em>
    <div>{lines(8, source === 'top' ? count : 0, false)}</div>
    <b>• • •</b>
    <div>{lines(8, source === 'bottom' ? count : 0, true)}</div>
    <em className={source === 'bottom' ? 'picked' : ''}>Fundo</em>
  </div>;
}

function SourceOption({ value, icon, title, description, source, busy, onSource }: { value: Source; icon: TableIconName; title: string; description: string; source: Source; busy: boolean; onSource: (source: Source) => void }) {
  return <label className={`library-source-option ${source === value ? 'selected' : ''}`}>
    <input type="radio" name="library-source" aria-label={title} checked={source === value} disabled={busy} onChange={() => onSource(value)} />
    <TableIcon name={icon} />
    <span><strong>{title}</strong><small>{description}</small></span>
    <i className="library-radio" aria-hidden="true" />
  </label>;
}

export function LibrarySetup({ view, source, count, libraryCount, busy, viewers, onSource, onCount, onBegin, onCancel }: Props) {
  const valid = Number.isInteger(count) && count >= 1 && count <= libraryCount;
  const stepper = { count, libraryCount, busy, onCount };
  const action = view === 'draw' ? `Comprar ${cardsLabel(count)}` : view === 'reveal' ? `Revelar ${cardsLabel(count)}` : `Olhar ${cardsLabel(count)} do ${source === 'top' ? 'topo' : 'fundo'}`;
  return <div className={`library-setup library-setup-${view}`}>
    {view === 'draw' && <>
      <DrawScene count={count} libraryCount={libraryCount} />
      <LibrarySection title="Quantidade"><CountStepper {...stepper} large /><p className="library-caption">Do topo do grimório para a sua mão.</p></LibrarySection>
    </>}
    {view === 'look' && <>
      <p className="library-pill"><TableIcon name="lock" />Só você verá estas cartas</p>
      <div className="library-look">
        <DepthDiagram source={source} count={count} />
        <div className="library-look-controls">
          <LibrarySection title="De onde">
            <div className="library-source-options" role="radiogroup" aria-label="De onde">
              <SourceOption value="top" icon="library-top" title="Do topo" description="As próximas a comprar" source={source} busy={busy} onSource={onSource} />
              <SourceOption value="bottom" icon="library-bottom" title="Do fundo" description="As últimas do grimório" source={source} busy={busy} onSource={onSource} />
            </div>
          </LibrarySection>
          <LibrarySection title="Quantidade"><CountStepper {...stepper} /></LibrarySection>
        </div>
      </div>
    </>}
    {view === 'reveal' && <>
      <p className="library-pill public"><TableIcon name="sun" />Todos os jogadores verão estas cartas</p>
      <div className="library-scene library-reveal-scene" aria-hidden="true"><span className="library-rays" /><LibraryCardBack /><em>Do topo do grimório</em></div>
      <LibrarySection title="Quem vai ver">
        <ul className="library-viewers">{viewers.map(viewer => <li key={viewer.userId} style={{ '--order-color': viewer.color } as CSSProperties}><span className="turn-order-shield">{viewer.position}</span><span>{viewer.name}</span></li>)}</ul>
      </LibrarySection>
      <LibrarySection title="Quantidade"><CountStepper {...stepper} /></LibrarySection>
    </>}
    <GameActionFooter onCancel={onCancel} disabled={busy || !valid} onConfirm={onBegin} label={action} />
  </div>;
}
