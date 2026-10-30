import type { ReactNode } from 'react';
import { TableIcon, type TableIconName } from './TableIcon';

type Tile = { icon: TableIconName; tone: string; title: string; label: string; description?: string; chip: string; chipIcon: TableIconName; publicChip?: boolean; opensModal?: boolean; disabled: boolean; onClick: () => void };

export function LibrarySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="library-section" aria-label={title}><h3>{title}</h3>{children}</section>;
}

function MenuTile({ tile, tall = false }: { tile: Tile; tall?: boolean }) {
  return <button type="button" aria-label={tile.label} className={`library-tile ${tall ? 'library-tile-tall' : 'library-tile-row'}`} disabled={tile.disabled} onClick={tile.onClick}>
    {tile.opensModal && <span className="library-tile-external"><TableIcon name="external" /></span>}
    <span className={`library-medal library-medal-${tile.tone}`}><TableIcon name={tile.icon} /></span>
    <span className="library-tile-text">
      <strong>{tile.title}</strong>
      {tile.description && <small>{tile.description}</small>}
      <span className={`library-chip ${tile.publicChip ? 'public' : ''}`}><TableIcon name={tile.chipIcon} />{tile.chip}</span>
    </span>
  </button>;
}

export function LibraryMenu({ disabled, empty, onDraw, onShuffle, onLook, onSearch, onReveal }: {
  disabled: boolean; empty: boolean; onDraw: () => void; onShuffle: () => void; onLook: () => void; onSearch: () => void; onReveal: () => void;
}) {
  const unavailable = disabled || empty;
  return <div className="library-menu">
    <LibrarySection title="Mexer no grimório">
      <div className="library-move-tiles">
        <MenuTile tile={{ icon: 'library-draw', tone: 'green', title: 'Comprar', label: 'Comprar cartas', chip: 'Vai para a mão', chipIcon: 'library-draw', disabled: unavailable, onClick: onDraw }} />
        <MenuTile tile={{ icon: 'library-shuffle', tone: 'ember', title: 'Embaralhar', label: 'Embaralhar', chip: 'Na hora', chipIcon: 'bolt', disabled, onClick: onShuffle }} />
      </div>
    </LibrarySection>
    <LibrarySection title="Ver cartas">
      <div className="library-view-tiles">
        <MenuTile tall tile={{ icon: 'eye', tone: 'violet', title: 'Olhar', label: 'Olhar cartas', description: 'Topo ou fundo', chip: 'Só você vê', chipIcon: 'lock', disabled: unavailable, onClick: onLook }} />
        <MenuTile tall tile={{ icon: 'search-plus', tone: 'teal', title: 'Buscar', label: 'Buscar no grimório', description: 'Todas as cartas', chip: 'Só você vê', chipIcon: 'lock', opensModal: true, disabled: unavailable, onClick: onSearch }} />
        <MenuTile tall tile={{ icon: 'sun', tone: 'gold', title: 'Revelar', label: 'Revelar cartas', description: 'Do topo', chip: 'Todos veem', chipIcon: 'sun', publicChip: true, disabled: unavailable, onClick: onReveal }} />
      </div>
    </LibrarySection>
  </div>;
}
