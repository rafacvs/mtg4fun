import { statusCounts, type LobbyFilters, type StatusFilter } from './lobbyFilters';
import type { Room } from './roomsApi';

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'preparing', label: 'Em preparação' },
  { value: 'started', label: 'Em andamento' },
];

export function LobbyToolbar({ rooms, filters, onChange }: {
  rooms: Room[]; filters: LobbyFilters; onChange: (filters: LobbyFilters) => void;
}) {
  const counts = statusCounts(rooms, filters);
  return <div className="lobby-toolbar">
    <div className="lobby-tabs" role="group" aria-label="Filtrar por estado">
      {statusTabs.map(tab => <button key={tab.value} type="button" className={`lobby-tab lobby-tab-${tab.value}`} aria-pressed={filters.status === tab.value} onClick={() => onChange({ ...filters, status: tab.value })}>
        <span>{tab.label}</span><b>{counts[tab.value]}</b>
      </button>)}
    </div>
    <div className="lobby-refine">
      <label className="lobby-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4.5 4.5" /></svg>
        <span className="lobby-sr">Buscar mesa ou jogador</span>
        <input type="search" placeholder="Mesa ou jogador" value={filters.query} onChange={event => onChange({ ...filters, query: event.target.value })} />
      </label>
      <button type="button" className="lobby-vacant" aria-pressed={filters.onlyVacant} onClick={() => onChange({ ...filters, onlyVacant: !filters.onlyVacant })}>
        <i aria-hidden="true" />Com vaga
      </button>
    </div>
  </div>;
}
