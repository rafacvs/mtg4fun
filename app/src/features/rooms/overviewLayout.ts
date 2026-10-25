import { projectBattlefield } from './battlefieldLayout.ts';
import type { Card } from './roomsApi';

type OverviewCard = Pick<Card, 'id' | 'positionX' | 'row' | 'stackOrder' | 'tapped'>;

export function overviewLayout(cards: OverviewCard[]) {
  return projectBattlefield(cards).layout;
}
