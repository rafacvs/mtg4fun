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
