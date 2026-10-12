import { markerColors, markerValue } from './CounterControls';
import type { Markers } from './roomsApi';

function formatModifier(value: number) {
  if (value > 0) return `+${value}`;
  if (value === 0) return '+0';
  return `${value}`;
}

export function powerToughnessText(power = 0, toughness = 0) {
  if (!power && !toughness) return '';
  return `${formatModifier(power)}/${formatModifier(toughness)}`;
}

export function MarkerReadout({ markers }: { markers?: Markers }) {
  const visible = markerColors.filter(item => markerValue(markers, item.color) !== 0);
  if (!visible.length) return null;
  return <span className="marker-dots">{visible.map(item => <span key={item.color} className={`marker-dot marker-${item.color}`} aria-label={`marcador ${item.name}`}>{markerValue(markers, item.color)}</span>)}</span>;
}

export function CardStats({ power, toughness, markers }: { power?: number; toughness?: number; markers?: Markers }) {
  const text = powerToughnessText(power, toughness);
  const hasMarkers = markerColors.some(item => markerValue(markers, item.color) !== 0);
  if (!text && !hasMarkers) return null;
  return <span className="card-stats">{text && <span className="pt-modifier">{text}</span>}<MarkerReadout markers={markers} /></span>;
}
