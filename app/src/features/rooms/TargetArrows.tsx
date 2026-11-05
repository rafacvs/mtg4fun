import { useEffect, useRef, useState } from 'react';
import type { Match } from './roomsApi';
import { seatColors } from './PlayerSeat';
import './target-arrows.css';

type Point = { x: number; y: number };
type Line = { from: Point; to: Point; key: string; ownerId: number };

function center(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function targetEdge(element: Element, from: Point): Point {
  const rect = element.getBoundingClientRect();
  const middle = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const dx = from.x - middle.x, dy = from.y - middle.y;
  if (dx === 0 && dy === 0) return middle;
  const scale = Math.min(dx ? (rect.width / 2 + 3) / Math.abs(dx) : Infinity, dy ? (rect.height / 2 + 3) / Math.abs(dy) : Infinity, 1);
  return { x: middle.x + dx * scale, y: middle.y + dy * scale };
}

export function TargetArrows({ match, add, clear }: { match: Match; add: (source: string, target: string | undefined, player: number | undefined) => Promise<boolean>; clear: () => Promise<boolean> }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<{ source: string; to: Point } | null>(null);
  const latest = useRef({ match, add, clear });
  latest.current = { match, add, clear };

  useEffect(() => {
    let frame = 0;
    const card = (id: string) => Array.from(document.querySelectorAll<HTMLElement>('.battlefield-canvas [data-card-id]')).find(node => node.dataset.cardId === id && node.getBoundingClientRect().width > 0);
    const render = () => {
      const next: Line[] = [];
      latest.current.match.arrows?.forEach((arrow, index) => {
        const source = card(arrow.sourceCardId);
        const target = arrow.targetCardId ? card(arrow.targetCardId) : Array.from(document.querySelectorAll(`[data-arrow-player="${arrow.targetPlayerId}"]`)).find(node => node.getBoundingClientRect().width > 0);
        if (source && target && target.getBoundingClientRect().width) {
          const from = center(source);
          next.push({ from, to: targetEdge(target, from), key: String(index), ownerId: arrow.ownerId });
        }
      });
      setLines(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    let stop: (() => void) | undefined;
    const down = (event: PointerEvent) => {
      if (event.button !== 2 || event.pointerType !== 'mouse') return;
      const source = (event.target as Element).closest<HTMLElement>('.battlefield-canvas [data-card-id]');
      if (!source?.dataset.cardId) return;
      const id = source.dataset.cardId;
      event.preventDefault();
      let moved = false;
      const origin = { x: event.clientX, y: event.clientY };
      const move = (e: PointerEvent) => { if (e.pointerId !== event.pointerId) return; if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 5) moved = true; if (moved) setDraft({ source: id, to: { x: e.clientX, y: e.clientY } }); };
      const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); setDraft(null); stop = undefined; };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        if (moved) {
          const hit = document.elementFromPoint(e.clientX, e.clientY);
          const target = hit?.closest<HTMLElement>('.battlefield-canvas [data-card-id]')?.dataset.cardId;
          const player = hit?.closest<HTMLElement>('[data-arrow-player]')?.dataset.arrowPlayer ?? Array.from(document.querySelectorAll<HTMLElement>('[data-arrow-player]')).find(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && e.clientX >= box.left - 12 && e.clientX <= box.right + 12 && e.clientY >= box.top - 12 && e.clientY <= box.bottom + 12; })?.dataset.arrowPlayer;
          if (target || player) void latest.current.add(id, target, player ? Number(player) : undefined);
        }
        cleanup();
      };
      const cancel = (e: PointerEvent) => { if (e.pointerId === event.pointerId) cleanup(); };
      stop?.(); stop = cleanup;
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    };
    const context = (event: MouseEvent) => { if ((event.target as Element).closest('.battlefield-canvas [data-card-id]')) { event.preventDefault(); event.stopPropagation(); } };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('[role="dialog"]') && latest.current.match.arrows?.some(arrow => arrow.ownerId === latest.current.match.viewerId)) void latest.current.clear(); };
    document.addEventListener('pointerdown', down, true); document.addEventListener('contextmenu', context, true); window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(frame); stop?.(); document.removeEventListener('pointerdown', down, true); document.removeEventListener('contextmenu', context, true); window.removeEventListener('keydown', key); };
  }, []);

  const source = draft && Array.from(document.querySelectorAll<HTMLElement>('.battlefield-canvas [data-card-id]')).find(node => node.dataset.cardId === draft.source);
  const displayed = source && draft ? [...lines, { from: center(source), to: draft.to, key: 'draft', ownerId: match.viewerId }] : lines;
  return <svg className="target-arrows" aria-hidden="true">{displayed.map(line => {
    const dx = line.to.x - line.from.x, dy = line.to.y - line.from.y;
    const bend = Math.min(110, Math.hypot(dx, dy) * 0.18);
    const length = Math.hypot(dx, dy) || 1;
    const cx = (line.from.x + line.to.x) / 2 - dy / length * bend;
    const cy = (line.from.y + line.to.y) / 2 + dx / length * bend;
    const tangentLength = Math.hypot(line.to.x - cx, line.to.y - cy) || 1;
    const ux = (line.to.x - cx) / tangentLength, uy = (line.to.y - cy) / tangentLength;
    const baseX = line.to.x - ux * 15, baseY = line.to.y - uy * 15;
    const index = match.players.findIndex(player => player.userId === line.ownerId);
    const color = seatColors[Math.max(0, index) % seatColors.length];
    const path = `M ${line.from.x} ${line.from.y} Q ${cx} ${cy} ${line.to.x} ${line.to.y}`;
    return <g key={line.key} data-arrow-owner={line.ownerId} style={{ color }}><path className="target-arrow-line" d={path} /><polygon className="target-arrow-head" points={`${line.to.x},${line.to.y} ${baseX - uy * 7},${baseY + ux * 7} ${baseX + uy * 7},${baseY - ux * 7}`} /><circle cx={line.from.x} cy={line.from.y} r="3.5" /></g>;
  })}</svg>;
}
