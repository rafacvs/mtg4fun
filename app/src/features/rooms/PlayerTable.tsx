import type { Card, Match } from './roomsApi';

export const zoneNames: Record<string, string> = { library: 'Grimório', hand: 'Mão', battlefield: 'Campo', graveyard: 'Cemitério', exile: 'Exílio', command: 'Comando' };

type CardsProps = { zone: string; count: number; cards?: Card[]; onSelect?: (card: Card) => void; selected?: string };

export function CardsZone({ zone, count, cards = [], onSelect, selected }: CardsProps) {
  return <section className={`table-zone zone-${zone}`} aria-label={zoneNames[zone]}>
    <header><span>{zoneNames[zone]}</span><strong aria-label={`${count} cartas`}>{count}</strong></header>
    <div className="zone-cards">{cards.map(card => <button className={`playing-card ${selected === card.id ? 'selected-card' : ''}`} aria-pressed={selected === card.id} type="button" key={card.id} onClick={() => onSelect?.(card)}>{card.name}</button>)}
      {cards.length === 0 && <span className="zone-placeholder" aria-hidden="true">{zone === 'library' || zone === 'hand' && count > 0 ? '✦' : zoneNames[zone]}</span>}
    </div>
  </section>;
}

type Props = { player: Match['players'][number]; focused: boolean; own: boolean; selected?: string; onSelect: (card: Card) => void; onFocus: () => void };

export function PlayerTable({ player, focused, own, selected, onSelect, onFocus }: Props) {
  return <article className={`player-table ${focused ? 'focused-table' : ''}`} aria-label={`Mesa de ${player.name}`}>
    <header className="player-heading"><h2>{player.name}{own && <small> · Você</small>}</h2><span>Vida: {player.life}</span><button className="secondary" onClick={onFocus} aria-label={`Ampliar mesa de ${player.name}`}>Ampliar</button></header>
    <div className="table-zones" aria-label={`Zonas de ${player.name}`}>
      <CardsZone zone="battlefield" count={player.battlefieldCount} cards={player.battlefield} selected={selected} onSelect={onSelect} />
      <div className="side-zones">
        <CardsZone zone="library" count={player.libraryCount} />
        <CardsZone zone="graveyard" count={player.graveyardCount} cards={player.graveyard} selected={selected} onSelect={onSelect} />
        <CardsZone zone="exile" count={player.exileCount} cards={player.exile} selected={selected} onSelect={onSelect} />
        <CardsZone zone="command" count={player.commandCount} cards={player.command} selected={selected} onSelect={onSelect} />
      </div>
      {!own && <div className="opponent-hand" aria-label={`Mão de ${player.name}`}>Mão: {player.handCount} carta(s) · Privada</div>}
    </div>
  </article>;
}
