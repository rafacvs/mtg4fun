import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { TableIcon, type TableIconName } from './TableIcon';
import './table-panels.css';

// Only the topmost panel handles dismissal or traps focus. Polling never refocuses inputs.
export function usePanelFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, returnFocus?: HTMLElement) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const previous = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    panel.querySelector<HTMLElement>('[data-panel-close], button, input, select')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if ([...document.querySelectorAll('[role="dialog"], dialog[open]')].at(-1) !== panel) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const nodes = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length > 0);
      const first = nodes[0];
      const last = nodes.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, ref, returnFocus]);
}

export function TablePanel({ open, label, anchor, wide = false, fitViewport = false, align = 'end', className = '', children, onClose }: {
  open: boolean; label: string; anchor?: HTMLElement | null; wide?: boolean; align?: 'start' | 'end' | 'above';
  fitViewport?: boolean;
  className?: string; children: ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number; maxHeight?: number }>({ left: 12, top: 12 });
  usePanelFocus(ref, open, onClose, anchor?.matches('button, a[href], input, select, [tabindex]') ? anchor : undefined);
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const position = () => {
      const box = panel.getBoundingClientRect();
      const origin = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const offsetY = viewport?.offsetTop ?? 0;
      const toolbarBottom = document.querySelector('.table-toolbar')?.getBoundingClientRect().bottom ?? 0;
      const minimumTop = wide ? offsetY + 12 : Math.max(offsetY + 12, toolbarBottom + 8);
      let maximumHeight = Math.max(80, offsetY + height - minimumTop - 12);
      let left = (width - box.width) / 2;
      let top = offsetY + (height - box.height) / 2;
      if (origin && !wide) {
        if (align === 'above') {
          // Opens upward from the bar; a tall screen scrolls inside instead of covering the button.
          left = origin.right - box.width;
          if (!fitViewport) maximumHeight = Math.max(80, origin.top - 10 - minimumTop);
          top = Math.max(minimumTop, origin.top - Math.min(box.height, maximumHeight) - 10);
        } else if (align === 'start') {
          left = origin.left;
          top = origin.bottom + 8;
          if (top + box.height > offsetY + height - 12) top = origin.top - box.height - 8;
        } else {
          left = origin.right + 10;
          if (left + box.width > width - 12) left = origin.left - box.width - 10;
          if (left < 12) left = origin.left;
          top = origin.top;
        }
      }
      setPlacement({ left: Math.max(12, Math.min(left, width - box.width - 12)), top: Math.max(minimumTop, Math.min(top, offsetY + height - box.height - 12)), maxHeight: maximumHeight });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open, anchor, wide, fitViewport, align]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || ref.current?.contains(target) || anchor?.contains(target)) return;
      if ([...document.querySelectorAll('[role="dialog"], dialog[open]')].at(-1) === ref.current) onClose();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, anchor, onClose]);
  if (!open) return null;
  return <><div className="table-panel-scrim" aria-hidden="true" onPointerDown={event => event.stopPropagation()} onClick={onClose} /><div ref={ref} role="dialog" aria-label={label} tabIndex={-1} className={`table-panel actions-panel ${wide ? 'table-panel-wide' : ''} ${className}`} style={placement}>{children}</div></>;
}

export function PanelHeader({ title, subtitle, onClose, onBack, closeLabel = 'Fechar menu', children }: {
  title: string; subtitle?: string; onClose: () => void; onBack?: () => void; closeLabel?: string; children?: ReactNode;
}) {
  return <header className="table-panel-header">
    {onBack && <button className="secondary icon-button" type="button" aria-label="Voltar" onClick={onBack}><TableIcon name="chevron-left" /></button>}
    <div>{subtitle && <p className="actions-kicker">{subtitle}</p>}<h2>{title}</h2>{children}</div>
    <button data-panel-close className="secondary icon-button panel-close" type="button" aria-label={closeLabel} onClick={onClose}><TableIcon name="close" /></button>
  </header>;
}

// The chevron marks items that open another screen; items without it act at once.
export function MenuItem({ icon, title, description, disabled, opens = true, onClick }: {
  icon: TableIconName; title: string; description?: string; disabled?: boolean; opens?: boolean; onClick: () => void;
}) {
  return <button type="button" aria-label={title} className="table-menu-item secondary" disabled={disabled} onClick={onClick}>
    <span className="menu-item-icon"><TableIcon name={icon} /></span>
    <span className="menu-item-label"><strong>{title}</strong>{description && <small>{description}</small>}</span>
    {opens && <TableIcon name="chevron" />}
  </button>;
}

export function PanelResult({ children }: { children: ReactNode }) {
  return <p role="status" className="panel-result"><TableIcon name="clock" /><span>{children}</span></p>;
}

export type PanelFeedbackProps = { error: string; busy: boolean; unconfirmed: boolean; onRetry: () => Promise<boolean> };

export function PanelFeedback({ error, busy, unconfirmed, onRetry }: PanelFeedbackProps) {
  if (!error) return null;
  return <p role="alert" className="error">{error}{unconfirmed && <button type="button" className="secondary" disabled={busy} onClick={() => void onRetry()}>Tentar novamente</button>}</p>;
}
