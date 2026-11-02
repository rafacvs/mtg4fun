import type { CSSProperties } from 'react';
import type { PlaymatSettings } from './playmatsApi';
import forest from '../../assets/theme/mat-forest.jpg';
import swamp from '../../assets/theme/mat-swamp.jpg';
import mountain from '../../assets/theme/mat-mountain.jpg';
import sea from '../../assets/theme/mat-sea.jpg';

export const presets = [
  { id: 'forest', name: 'Floresta enevoada', image: forest },
  { id: 'swamp', name: 'Crepúsculo roxo', image: swamp },
  { id: 'mountain', name: 'Brasas', image: mountain },
  { id: 'sea', name: 'Mar glacial', image: sea },
];
export function imageURL(settings: PlaymatSettings) {
  return settings.imageId ? `/api/playmats/${settings.imageId}/image` : (presets.find(preset => preset.id === settings.preset) ?? presets[0]).image;
}
export function playmatStyle(settings: PlaymatSettings): CSSProperties {
  return {
    '--playmat-image': `url("${imageURL(settings)}")`,
    '--playmat-shade': `rgb(0 0 0 / ${settings.dim / 100})`,
    '--playmat-size': settings.fit === 'stretch' ? `${settings.zoom}% ${settings.zoom}%` : settings.fit === 'repeat' ? `${settings.zoom / 2}% auto` : settings.fit,
    '--playmat-repeat': settings.fit === 'repeat' ? 'repeat' : 'no-repeat',
    '--playmat-scale': settings.fit === 'cover' || settings.fit === 'contain' ? settings.zoom / 100 : 1,
  } as CSSProperties;
}
