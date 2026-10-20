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
  let paddingX = MIN_PADDING;
  let paddingY = MIN_PADDING;
  let layout = battlefieldLayout(cards, paddingX, paddingY);
  while (visibleWidth > layout.width && paddingX < MIN_PADDING + 60) {
    paddingX += 1;
    layout = battlefieldLayout(cards, paddingX, paddingY);
  }
  while (visibleHeight > layout.height && paddingY < MIN_PADDING + 60) {
    paddingY += 1;
    layout = battlefieldLayout(cards, paddingX, paddingY);
  }
  return layout;
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
  // Match the painted grid. Subtract a hair so rounding cannot append a cell
  // the canvas does not contain.
  const targetWidth = canvas.offsetWidth / cardWidth - 0.05;
  const targetHeight = canvas.offsetHeight / cardWidth - 0.05;
  return { layout: fitBattlefield(cards, targetWidth, targetHeight), cardWidth, zoom, box: canvas.getBoundingClientRect() };
}
