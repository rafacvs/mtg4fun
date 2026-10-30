import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { battlefieldLayout, CARD_ASPECT, fitBattlefield, viewExtent } from './battlefieldLayout';
import type { Card } from './roomsApi';

export function useFieldViewport(cards: Card[], cancelDrag: () => void, fitAllRequest = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const anchor = useRef<{ x: number; y: number; scrollX: number; scrollY: number; oldZoom: number } | null>(null);
  const centerTarget = useRef<{ left: number; top: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0, cardWidth: 76 });
  const cancel = useRef(cancelDrag);
  cancel.current = cancelDrag;
  zoomRef.current = zoom;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight, cardWidth: Number.parseFloat(getComputedStyle(node).getPropertyValue('--card-width')) || 76 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    const point = anchor.current;
    if (node && centerTarget.current) {
      node.scrollLeft = centerTarget.current.left;
      node.scrollTop = centerTarget.current.top;
      centerTarget.current = null;
      return;
    }
    if (!node || !point) return;
    node.scrollLeft = (point.scrollX + point.x) * zoom / point.oldZoom - point.x;
    node.scrollTop = (point.scrollY + point.y) * zoom / point.oldZoom - point.y;
    anchor.current = null;
  }, [zoom, size]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const apply = (next: number, clientX: number, clientY: number) => {
      const oldZoom = zoomRef.current;
      const value = Math.max(.001, Math.min(1000, next));
      const box = node.getBoundingClientRect();
      anchor.current = { x: clientX - box.left, y: clientY - box.top, scrollX: node.scrollLeft, scrollY: node.scrollTop, oldZoom };
      zoomRef.current = value;
      setZoom(value);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      apply(zoomRef.current * Math.exp(-event.deltaY * .002), event.clientX, event.clientY);
    };
    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      cancel.current();
      pinch = { distance: distance(event.touches), zoom: zoomRef.current };
    };
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      apply(pinch.zoom * distance(event.touches) / Math.max(1, pinch.distance), (event.touches[0].clientX + event.touches[1].clientX) / 2, (event.touches[0].clientY + event.touches[1].clientY) / 2);
    };
    const end = (event: TouchEvent) => { if (event.touches.length < 2) pinch = null; };
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    return () => { node.removeEventListener('wheel', wheel); node.removeEventListener('touchstart', start); node.removeEventListener('touchmove', move); node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', end); };
  }, []);

  const visibleWidth = size.width / (size.cardWidth * zoom);
  const visibleHeight = size.height / (size.cardWidth * zoom);
  const layout = fitBattlefield(cards, visibleWidth, visibleHeight);
  const extent = viewExtent(layout, visibleWidth, visibleHeight);
  const center = () => {
    const node = ref.current;
    if (!node) return;
    const occupied = battlefieldLayout(cards, 0, 0);
    const bounds = cards.reduce((result, card) => {
      const place = occupied.cards.get(card.id);
      if (!place) return result;
      return { left: Math.min(result.left, place.x), top: Math.min(result.top, place.y), right: Math.max(result.right, place.x + (card.tapped ? CARD_ASPECT : 1)), bottom: Math.max(result.bottom, place.y + (card.tapped ? 1 : CARD_ASPECT)) };
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
    const next = cards.length && width > 0 && height > 0 ? Math.min(size.width / (width * size.cardWidth), size.height / (height * size.cardWidth)) : 1;
    anchor.current = null;
    centerTarget.current = {
      left: cards.length ? Math.max(0, bounds.left * size.cardWidth * next - (size.width - width * size.cardWidth * next) / 2) : 0,
      top: cards.length ? Math.max(0, bounds.top * size.cardWidth * next - (size.height - height * size.cardWidth * next) / 2) : 0,
    };
    zoomRef.current = next;
    setZoom(next);
    if (next === zoom) { node.scrollLeft = centerTarget.current.left; node.scrollTop = centerTarget.current.top; centerTarget.current = null; }
  };
  const lastFitRequest = useRef(0);
  useLayoutEffect(() => {
    if (fitAllRequest === lastFitRequest.current || !size.width || !size.height) return;
    lastFitRequest.current = fitAllRequest;
    center();
  }, [fitAllRequest, size]);

  return { ref, layout, extent, zoom, center };
}
