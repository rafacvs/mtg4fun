import { useState } from 'react';
import { deckApi } from '../decks/deckApi';
import type { Card } from './roomsApi';
import { PanelHeader, TablePanel } from './TablePanel';
import './public-zone-viewer.css';

export function PublicZoneViewer({ title, playerName, cards, anchor, onInspect, onClose }: {
  title: string;
  playerName: string;
  cards: Card[];
  anchor: HTMLElement | null;
  onInspect: (card: Card) => void;
  onClose: () => void;
}) {
  return <TablePanel open anchor={anchor} wide label={`${title} de ${playerName}`} className="public-zone-viewer" onClose={onClose}>
    <PanelHeader title={`${title} de ${playerName}`} subtitle={cards.length === 1 ? '1 carta' : `${cards.length} cartas`} closeLabel={`Fechar ${title.toLocaleLowerCase('pt-BR')}`} onClose={onClose} />
    <div className="public-zone-cards" aria-label={`Cartas no ${title.toLocaleLowerCase('pt-BR')}`}>
      {[...cards].reverse().map((card, index) => <ZoneCard key={card.id} card={card} top={index === 0} onInspect={onInspect} />)}
    </div>
  </TablePanel>;
}

function ZoneCard({ card, top, onInspect }: { card: Card; top: boolean; onInspect: (card: Card) => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="public-zone-card" aria-label={`Ver imagem de ${card.name}`} onClick={() => onInspect(card)}>
    {failed ? <span className="public-zone-fallback">{card.name}</span> : <img src={deckApi.imageURL(card.faces?.[card.faceIndex ?? 0] || card.name)} alt="" onError={() => setFailed(true)} />}
    <span><strong>{card.name}</strong>{top && <small>Topo</small>}</span>
  </button>;
}
