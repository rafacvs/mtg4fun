import type { CurveBin, DeckCard, DeckGroups } from './deckApi';

export const GROUP_ORDER = ['commander', 'creatures', 'spells', 'artifacts', 'lands', 'other'] as const;

export const GROUP_LABELS: Record<(typeof GROUP_ORDER)[number], string> = {
  commander: 'Comandante',
  creatures: 'Criaturas',
  spells: 'Mágicas',
  artifacts: 'Artefatos',
  lands: 'Terrenos',
  other: 'Outras',
};

const COLOR_NAMES: Record<string, string> = {
  W: 'Branco',
  U: 'Azul',
  B: 'Preto',
  R: 'Vermelho',
  G: 'Verde',
};

export function colorNames(identity: string): string {
  return [...identity].map(symbol => COLOR_NAMES[symbol] ?? symbol).join(' ');
}

export function cardCount(cards: DeckCard[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

export function typeSummary(groups: DeckGroups): string {
  return GROUP_ORDER.filter(key => key !== 'commander' && groups[key].length > 0)
    .map(key => `${GROUP_LABELS[key]} ${cardCount(groups[key])}`)
    .join(' · ');
}

export function curveHeight(bin: CurveBin, peak: number): number {
  if (peak <= 0) return 8;
  return Math.max(8, Math.round((bin.count / peak) * 32));
}

export type ChartSegment = { label: string; count: number; color: string };

const chartColors = ['#d9a94e', '#3f8fd6', '#43a263', '#e0553a', '#8d79b8', '#d6d0bb', '#8f4b16'];

export function manaCurveSegments(curve: CurveBin[]): ChartSegment[] {
  const counts = new Map<number, number>();
  curve.filter(bin => bin.cmc > 0).forEach(bin => {
    const cmc = Math.min(bin.cmc, 6);
    counts.set(cmc, (counts.get(cmc) ?? 0) + bin.count);
  });
  return [...counts.entries()].sort(([left], [right]) => left - right)
    .map(([cmc, count], index) => ({ label: cmc === 6 ? 'CMC 6+' : `CMC ${cmc}`, count, color: chartColors[index % chartColors.length] }));
}

export function typeSegments(groups: DeckGroups): ChartSegment[] {
  return (['creatures', 'spells', 'artifacts', 'lands', 'other'] as const)
    .map((key, index) => ({ label: GROUP_LABELS[key], count: cardCount(groups[key]), color: chartColors[index % chartColors.length] }))
    .filter(segment => segment.count > 0);
}

export function colorSegments(groups: DeckGroups): ChartSegment[] {
  const counts = new Map<string, number>();
  const add = (label: string, quantity: number) => counts.set(label, (counts.get(label) ?? 0) + quantity);
  GROUP_ORDER.forEach(group => groups[group].forEach(card => {
    const colors = [...(card.colors ?? '')];
    if (group === 'lands' && colors.length === 0) add('Terrenos', card.quantity);
    else if (group === 'artifacts' && colors.length === 0) add('Artefatos', card.quantity);
    else if (colors.length === 0) add('Incolor', card.quantity);
    else if (colors.length > 1) add('Multicoloridas', card.quantity);
    else add(COLOR_NAMES[colors[0]] ?? colors[0], card.quantity);
  }));
  const colors: Record<string, string> = { Branco: '#eee9d8', Azul: '#3f8fd6', Preto: '#292631', Vermelho: '#e0553a', Verde: '#43a263', Multicoloridas: '#d9a94e', Incolor: '#a6a6b2', Artefatos: '#b9a16e', Terrenos: '#8f4b16' };
  return [...counts.entries()].map(([label, count]) => ({ label, count, color: colors[label] ?? '#8d79b8' }));
}
