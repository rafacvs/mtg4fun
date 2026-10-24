import { markerColors, markerValue } from './CounterControls';
import type { Card, Markers } from './roomsApi';

function formatModifier(value: number) {
  if (value > 0) return `+${value}`;
  if (value === 0) return '+0';
  return `${value}`;
}

export function powerToughnessText(power = 0, toughness = 0, printedPower?: string, printedToughness?: string) {
  if (!printedPower || !printedToughness) return '';
  if (/^[+-]?\d+$/.test(printedPower) && /^[+-]?\d+$/.test(printedToughness)) {
    return `${BigInt(printedPower) + BigInt(power)}/${BigInt(printedToughness) + BigInt(toughness)}`;
  }
  const printed = `${printedPower}/${printedToughness}`;
  return power || toughness ? `${printed} (${formatModifier(power)}/${formatModifier(toughness)})` : printed;
}

export function MarkerReadout({ markers }: { markers?: Markers }) {
  const visible = markerColors.filter(item => markerValue(markers, item.color) !== 0);
  if (!visible.length) return null;
  return <span className="marker-dots">{visible.map(item => <span key={item.color} className={`marker-dot marker-${item.color}`} aria-label={`marcador ${item.name}`}>{markerValue(markers, item.color)}</span>)}</span>;
}

export function CardStats({ power, toughness, printedPower, printedToughness, markers }: Pick<Card, 'power' | 'toughness' | 'printedPower' | 'printedToughness' | 'markers'>) {
  const text = powerToughnessText(power, toughness, printedPower, printedToughness);
  const hasMarkers = markerColors.some(item => markerValue(markers, item.color) !== 0);
  if (!text && !hasMarkers) return null;
  return <span className="card-stats">{text && <span className="pt-modifier" aria-label="Poder e resistência" data-modified={Boolean(power || toughness)}>{text}</span>}<MarkerReadout markers={markers} /></span>;
}
