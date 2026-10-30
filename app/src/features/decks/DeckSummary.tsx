import type { CSSProperties } from 'react';
import type { Deck } from './deckApi';
import { colorNames, colorSegments, manaCurveSegments, typeSegments, type ChartSegment } from './deckDisplay';

function PieChart({ label, segments }: { label: string; segments: ChartSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  let offset = 0;
  const stops = segments.map(segment => {
    const start = offset;
    offset += total ? segment.count / total * 100 : 0;
    return `${segment.color} ${start}% ${offset}%`;
  }).join(', ');
  if (!total) return <p className="chart-empty">Sem dados para este gráfico.</p>;
  return <div className="deck-pie-layout">
    <div className="deck-pie" role="img" aria-label={`${label}: ${segments.map(segment => `${segment.label} ${segment.count}`).join(', ')}`} style={{ '--pie-stops': stops } as CSSProperties}><span>{total}</span></div>
    <ul className="deck-chart-legend">{segments.map(segment => <li key={segment.label}><i style={{ background: segment.color }} /><span>{segment.label}</span><strong>{segment.count}</strong></li>)}</ul>
  </div>;
}

export function DeckSummary({ deck }: { deck: Deck }) {
  const curve = manaCurveSegments(deck.curve);
  const types = typeSegments(deck.groups);
  const colors = colorSegments(deck.groups);
  return <section className="deck-examples" aria-label="Dados do deck">
    <div className="deck-summary-heading"><span><small>Comandante</small><strong>{deck.commander || 'Nenhum'}</strong></span>{deck.colorIdentity && <span><small>Identidade</small><strong>{colorNames(deck.colorIdentity)}</strong></span>}</div>
    <div className="deck-chart-grid">
      <article className="deck-chart"><h5>Curva de mana</h5><PieChart label="Curva de mana" segments={curve} /></article>
      <article className="deck-chart"><h5>Análise de cores</h5><PieChart label="Análise de cores" segments={colors} /></article>
      <article className="deck-chart"><h5>Tipos de carta</h5><PieChart label="Tipos de carta" segments={types} /></article>
    </div>
  </section>;
}
