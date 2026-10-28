import type { Card } from './roomsApi';

// Card geometry in multiples of one upright card's width. The same ratios
// keep rows and columns aligned at every viewport and zoom.
export const CARD_ASPECT = 88 / 63;
export const STACK_SHIFT_X = 14 / 72;
export const STACK_SHIFT_Y = 16 / 72;
export const CELL_GAP = 10 / 72;
const MIN_PADDING = 2;

type LayoutCard = { id: string; positionX: number; row: number; stackOrder: number; tapped?: boolean };

export type PlacedCard = { x: number; y: number; index: number; size: number };

export type FieldCell = {
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
};

export type FieldLayout = {
  cards: Map<string, PlacedCard>;
  cells: FieldCell[];
  width: number;
  height: number;
};

export type BattlefieldProjection = {
  layout: FieldLayout;
  destination: (column: number, row: number) => { column: number; row: number };
};

// Positions are durable game data, while this map is solely the view's local
// coordinate system. Keeping one nearby empty cell preserves intentional
// grouping without allowing legacy coordinates (for example 120 → 720) to
// consume the whole visible field.
function compactAxis(values: number[]) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const projected = new Map<number, number>();
  const original = new Map<number, number>();
  let next = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const value = sorted[index]!;
    if (index > 0) next += Math.min(value - sorted[index - 1]!, 2);
    projected.set(value, next);
    original.set(next, value);
  }
  return { projected, original };
}

export function projectBattlefield(cards: LayoutCard[]): BattlefieldProjection {
  const rows = compactAxis(cards.map(card => card.row));
  const columns = new Map<number, ReturnType<typeof compactAxis>>();
  for (const row of rows.projected.keys()) columns.set(row, compactAxis(cards.filter(card => card.row === row).map(card => card.positionX)));
  const layout = battlefieldLayout(cards.map(card => ({
    ...card,
    positionX: columns.get(card.row)!.projected.get(card.positionX)!,
    row: rows.projected.get(card.row)!,
  })), 0, 0);
  return {
    layout,
    destination: (column, row) => {
      const originalRow = rows.original.get(row) ?? [...rows.original.entries()].sort((a, b) => Math.abs(a[0] - row) - Math.abs(b[0] - row))[0]?.[1] ?? 0;
      const axis = columns.get(originalRow);
      const candidates = axis ? [...axis.original.entries()] : [];
      const first = candidates.at(0);
      const last = candidates.at(-1);
      const originalColumn = axis?.original.get(column)
        ?? (first && column < first[0] ? first[1] - (first[0] - column) : undefined)
        ?? (last && column > last[0] ? last[1] + (column - last[0]) : undefined)
        ?? candidates.sort((a, b) => Math.abs(a[0] - column) - Math.abs(b[0] - column))[0]?.[1]
        ?? column;
      return { column: originalColumn, row: originalRow };
    },
  };
}

export function firstFreeCell(cards: { positionX: number; row: number }[]) {
  const counts = new Map<number, number>();
  let maxColumn = -1;
  for (const card of cards) {
    if (card.row !== 0) continue;
    counts.set(card.positionX, (counts.get(card.positionX) ?? 0) + 1);
    maxColumn = Math.max(maxColumn, card.positionX);
  }
  for (let column = 0; column <= maxColumn; column += 1) {
    if ((counts.get(column) ?? 0) < 3) return { column, row: 0 };
  }
  return { column: maxColumn + 1, row: 0 };
}

function footprint(cards: { tapped?: boolean }[]) {
  if (cards.length === 0) return { width: 1, height: CARD_ASPECT };
  let width = 0;
  let height = 0;
  cards.forEach((card, index) => {
    width = Math.max(width, index * STACK_SHIFT_X + (card.tapped ? CARD_ASPECT : 1));
    height = Math.max(height, index * STACK_SHIFT_Y + (card.tapped ? 1 : CARD_ASPECT));
  });
  return { width, height };
}

// Each row sizes its own cells. An empty column keeps the width of one upright
// card, so a gap that was aimed at stays put. padding adds empty cells past
// the last occupied column and row.
export function battlefieldLayout(cards: LayoutCard[], paddingX = MIN_PADDING, paddingY = MIN_PADDING): FieldLayout {
  const groups = new Map<string, LayoutCard[]>();
  let maxColumn = -1;
  let maxRow = -1;
  for (const card of cards) {
    const key = `${card.row}:${card.positionX}`;
    groups.set(key, [...groups.get(key) ?? [], card]);
    maxColumn = Math.max(maxColumn, card.positionX);
    maxRow = Math.max(maxRow, card.row);
  }
  const columns = Math.max(0, maxColumn + 1 + paddingX);
  const rows = Math.max(0, maxRow + 1 + paddingY);
  const placed = new Map<string, PlacedCard>();
  const cells: FieldCell[] = [];
  if (columns === 0 || rows === 0) return { cards: placed, cells, width: 0, height: 0 };
  let y = 0;
  let width = 0;
  for (let row = 0; row < rows; row += 1) {
    let x = 0;
    let rowHeight = 0;
    const rowCells: FieldCell[] = [];
    for (let column = 0; column < columns; column += 1) {
      const group = [...groups.get(`${row}:${column}`) ?? []].sort((a, b) => a.stackOrder - b.stackOrder || a.id.localeCompare(b.id));
      const size = footprint(group);
      group.forEach((card, index) => placed.set(card.id, { x: x + index * STACK_SHIFT_X, y: y + index * STACK_SHIFT_Y, index, size: group.length }));
      rowCells.push({ column, row, x, y, width: size.width, height: size.height, size: group.length });
      rowHeight = Math.max(rowHeight, size.height);
      x += size.width + CELL_GAP;
    }
    for (const cell of rowCells) cell.height = rowHeight;
    cells.push(...rowCells);
    width = Math.max(width, x - CELL_GAP);
    y += rowHeight + CELL_GAP;
  }
  return { cards: placed, cells, width, height: y - CELL_GAP };
}

// The visible field stays covered by cells, with at least two empty columns
// and two empty rows beyond the last card.
export function fitBattlefield(cards: LayoutCard[], visibleWidth: number, visibleHeight: number) {
  const initial = battlefieldLayout(cards, MIN_PADDING, MIN_PADDING);
  const extraColumns = Math.min(60, Math.max(0, Math.ceil((visibleWidth - initial.width) / (1 + CELL_GAP))));
  const extraRows = Math.min(60, Math.max(0, Math.ceil((visibleHeight - initial.height) / (CARD_ASPECT + CELL_GAP))));
  return extraColumns || extraRows ? battlefieldLayout(cards, MIN_PADDING + extraColumns, MIN_PADDING + extraRows) : initial;
}

export function dropCell(layout: FieldLayout, x: number, y: number) {
  const cell = layout.cells.find(item => x >= item.x && x < item.x + item.width + CELL_GAP && y >= item.y && y < item.y + item.height + CELL_GAP);
  if (!cell) return null;
  if (cell.size < 3) return { column: cell.column, row: cell.row };
  const next = layout.cells.find(item => item.row === cell.row && item.column > cell.column && item.size < 3);
  return next ? { column: next.column, row: next.row } : null;
}

export function layoutFromCanvas(cards: Card[], canvas: HTMLElement) {
  const zoom = Number(canvas.dataset.zoom || '1') || 1;
  const cardWidth = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--card-width')) || 76;
  const layout = fitBattlefield(cards, canvas.offsetWidth / cardWidth - 0.05, canvas.offsetHeight / cardWidth - 0.05);
  return { layout, cardWidth, zoom, box: canvas.getBoundingClientRect() };
}
