import matForest from '../../assets/theme/mat-forest.jpg';
import matMountain from '../../assets/theme/mat-mountain.jpg';
import matSea from '../../assets/theme/mat-sea.jpg';
import matSwamp from '../../assets/theme/mat-swamp.jpg';

// Inicial e, quando houver, o número no fim do nome: rafa2 vira R2.
export function playerMark(name: string) {
  const initial = name.trim().slice(0, 1).toUpperCase();
  return initial + (name.match(/\d+$/)?.[0].slice(-1) ?? '');
}

// A paisagem do lugar segue a cor do deck; a cor mais marcante vem primeiro.
export function deckArt(colors = '') {
  if (colors.includes('B')) return matSwamp;
  if (colors.includes('U')) return matSea;
  if (colors.includes('R')) return matMountain;
  return matForest;
}
