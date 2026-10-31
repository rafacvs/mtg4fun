import { TableIcon } from './TableIcon';

// Cobre o card inteiro: o lápis só indica, no canto, que ele é editável.
export function DeckEditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return <button type="button" className="preparation-deck-edit" aria-label={`Editar deck ${name}`} onClick={onClick}><TableIcon name="edit" /></button>;
}
