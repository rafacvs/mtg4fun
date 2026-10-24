import type { Card } from './roomsApi';
import './card-actions.css';

export function CardActionBar({ cards, viewerId, disabled, onTapped, onReveal, onMove, onMarker, onMore, onClear }: {
  cards: Card[]; viewerId: number; disabled: boolean;
  onTapped: (ids: string[], tapped: boolean) => void;
  onReveal: (ids: string[]) => void;
  onMove: (ids: string[], destination: string) => void;
  onMarker: (ids: string[]) => void;
  onMore: () => void; onClear: () => void;
}) {
  if (!cards.length) return null;
  const first = cards[0];
  const ids = cards.map(card => card.id);
  const editable = cards.every(card => card.controllerId === viewerId);
  const field = cards.every(card => card.zone === 'battlefield');
  const hand = cards.every(card => card.zone === 'hand');
  return <div className="card-action-bar" role="toolbar" aria-label="Ações da seleção">
    <span>{cards.length} selecionada{cards.length > 1 ? 's' : ''}</span>
    {editable && <>
      {field && <button disabled={disabled} onClick={() => onTapped(ids, !first.tapped)}>{first.tapped ? 'Desvirar' : 'Virar'}</button>}
      {hand && <><button disabled={disabled} onClick={() => onMove(ids, 'battlefield')}>Jogar no campo</button><button disabled={disabled} onClick={() => onReveal(ids)}>Revelar</button></>}
      {!hand && <button disabled={disabled} onClick={() => onMove(ids, 'hand')}>Mão</button>}
      <button disabled={disabled} onClick={() => onMove(ids, 'graveyard')}>Cemitério</button>
      <button disabled={disabled} onClick={() => onMove(ids, 'exile')}>Exílio</button>
      <button disabled={disabled} onClick={() => onMove(ids, 'library-top')}>Topo</button>
      <button disabled={disabled} onClick={() => onMarker(ids)}>+1 marcador</button>
    </>}
    <button disabled={disabled} onClick={onMore}>Mais</button>
    <button className="secondary" onClick={onClear}>Limpar seleção</button>
  </div>;
}
