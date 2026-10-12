export function CounterValues({ counters }: { counters?: Record<string, number> }) {
  const values = Object.entries(counters ?? {});
  if (!values.length) return null;
  return <span className="counter-values">{values.map(([name, value]) => <span key={name}>{name}: {value}</span>)}</span>;
}
