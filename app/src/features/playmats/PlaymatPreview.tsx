import type { CSSProperties } from 'react';
import type { PlaymatSettings } from './playmatsApi';
import { playmatStyle } from './playmatStyle';

export function PlaymatPreview({ settings, ratio, name }: { settings: PlaymatSettings; ratio: string; name: string }) {
  return <div className="playmat-preview-frame">
    <div className="playmat-preview" role="img" aria-label={`Prévia do playmat em ${ratio}`} style={{ ...playmatStyle(settings), aspectRatio: ratio === 'Celular' ? '9 / 16' : ratio.replace(':', ' / ') } as CSSProperties}>
      <div className="playmat-preview-art" />
      <aside className="playmat-preview-rail"><span className="preview-seat" /><strong>40</strong><small>vida</small><span className="preview-command">♛</span><small>93 grimório</small><small>0 cemitério</small></aside>
      <div className="playmat-preview-name">{name}<span>SUA VEZ</span></div>
      <div className="playmat-preview-hand" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <span key={index} style={{ '--hand-angle': `${(index - 3) * 2}deg` } as CSSProperties} />)}</div>
    </div>
  </div>;
}
