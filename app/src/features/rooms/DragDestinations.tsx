const destinations = [
  ['battlefield', 'Campo'], ['hand', 'Mão'], ['graveyard', 'Cemitério'], ['exile', 'Exílio'],
  ['command', 'Comando'], ['library', 'Topo'], ['library-bottom', 'Fundo'],
] as const;

export function DragDestinations({ active }: { active: string | null }) {
  return <section className="drag-destinations" aria-label="Destinos do arraste">
    <span>Soltar em</span>
    {destinations.map(([zone, title]) => <button key={zone} type="button" data-drop-zone={zone} aria-current={active === zone ? 'true' : undefined} className={active === zone ? 'drop-hover' : ''}>{title}</button>)}
  </section>;
}
