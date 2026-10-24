import type { Deck } from './deckApi';
import { colorNames, curveHeight, typeSummary } from './deckDisplay';

export function DeckSummary({ deck }: { deck: Deck }) {
  const peak = deck.curve.reduce((max, bin) => Math.max(max, bin.count), 0);
  const types = typeSummary(deck.groups);
  return <section className="deck-examples" aria-label="Dados do deck">
    <dl>
      <div><dt>Comandante</dt><dd>{deck.commander || 'Nenhum'}</dd></div>
      {deck.colorIdentity ? <div><dt>Cores</dt><dd>{colorNames(deck.colorIdentity)}</dd></div> : null}
      <div><dt>Curva</dt><dd className="example-curve" aria-label="Curva de mana">{deck.curve.map(bin => <span key={bin.cmc} style={{ height: curveHeight(bin, peak) }}>{bin.cmc}</span>)}</dd></div>
      {types ? <div><dt>Tipos</dt><dd>{types}</dd></div> : null}
    </dl>
  </section>;
}
