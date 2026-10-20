const paths = {
  draw: 'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4',
  untap: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  actions: 'M5 5h2v2H5zM17 5h2v2h-2zM5 17h2v2H5zM17 17h2v2h-2zM11 11h2v2h-2z',
  library: 'M5 4h12l2 3v14H5zM5 7h14M8 11h8M8 15h6',
  shuffle: 'M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 4M3 19h3c2 0 4-3 6-7s4-7 6-7h3m-4-4 4 4-4 4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  reveal: 'M12 3v3m0 12v3M3 12h3m12 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M9 9h6v6H9z',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',
  coin: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v10m-3-8h4a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h4',
  next: 'M4 12h15m-6-6 6 6-6 6',
  previous: 'M20 12H5m6-6-6 6 6 6',
  token: 'm12 2 9 5v10l-9 5-9-5V7Zm0 5v10m-5-5h10',
  heart: 'M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 1 10 8 16 7-6 13-11 8-16Z',
  markers: 'M10 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm12 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-6 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
  log: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
  close: 'm6 6 12 12M6 18 18 6',
  chevron: 'm9 5 7 7-7 7',
  move: 'M5 3h8v12H5zM13 9h6v12h-8v-6m5-3 3 3-3 3',
  adjust: 'M4 7h16M4 17h16M8 3v8m8 2v8',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
  back: 'M19 12H5m6-6-6 6 6 6',
  hand: 'M5 18 2 8l4-1 4 11m-2-9V3h5v15m0-11 4-1 4 12H5',
  graveyard: 'M5 21V9a7 7 0 0 1 14 0v12ZM3 21h18M12 7v7m-3-4h6',
  exile: 'm12 2 10 10-10 10L2 12ZM8 8l8 8m0-8-8 8',
  crown: 'm3 7 4 4 5-8 5 8 4-4-2 13H5ZM5 17h14',
  power: 'm4 20 8-8M3 15l6 6M9 9l9-7 4 4-7 9ZM9 9l6 6',
} satisfies Record<string, string>;

export type TableIconName = keyof typeof paths;
export function TableIcon({ name }: { name: TableIconName }) {
  return <svg className="table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
