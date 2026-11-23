import { markerColors, markerValue } from './CounterControls';
import type { Card, Markers } from './roomsApi';

export function powerToughnessText(power = 0, toughness = 0, printedPower?: string, printedToughness?: string, typedCounters?: Card['typedCounters']) {
  const delta = BigInt(typedCounters?.plusOne ?? 0) - BigInt(typedCounters?.minusOne ?? 0);
  const adjustedPower = BigInt(power) + delta, adjustedToughness = BigInt(toughness) + delta;
  const format = (value: bigint) => value >= 0n ? `+${value}` : `${value}`;
  if (!printedPower || !printedToughness) return adjustedPower || adjustedToughness ? `${format(adjustedPower)}/${format(adjustedToughness)}` : '';
  if (/^[+-]?\d+$/.test(printedPower) && /^[+-]?\d+$/.test(printedToughness)) {
    return `${BigInt(printedPower) + adjustedPower}/${BigInt(printedToughness) + adjustedToughness}`;
  }
  const printed = `${printedPower}/${printedToughness}`;
  return adjustedPower || adjustedToughness ? `${printed} (${format(adjustedPower)}/${format(adjustedToughness)})` : printed;
}

export function MarkerReadout({ markers }: { markers?: Markers }) {
  const visible = markerColors.filter(item => markerValue(markers, item.color) !== 0);
  if (!visible.length) return null;
  return <span className="marker-dots">{visible.map(item => <span key={item.color} className={`marker-dot marker-${item.color}`} aria-label={`marcador ${item.name}`}>{markerValue(markers, item.color)}</span>)}</span>;
}

export function CardStats({ power, toughness, printedPower, printedToughness, markers, typedCounters }: Pick<Card, 'power' | 'toughness' | 'printedPower' | 'printedToughness' | 'markers' | 'typedCounters'>) {
  const text = powerToughnessText(power, toughness, printedPower, printedToughness, typedCounters);
  const hasMarkers = markerColors.some(item => markerValue(markers, item.color) !== 0);
  if (!text && !hasMarkers) return null;
  return <span className="card-stats">{text && <span className="pt-modifier" aria-label="Poder e resistência" data-modified={Boolean(power || toughness)}>{text}</span>}<MarkerReadout markers={markers} /></span>;
}
