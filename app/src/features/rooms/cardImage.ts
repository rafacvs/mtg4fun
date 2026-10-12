import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';

export function cardImageURL(card: Pick<Card, 'name' | 'faces' | 'faceIndex' | 'imageName' | 'instanceKind'>): string {
  const name = card.faces?.[card.faceIndex ?? 0] || card.imageName;
  if (name) return deckApi.imageURL(name);
  if (card.instanceKind) return '/token-default.svg';
  return deckApi.imageURL(card.name);
}
