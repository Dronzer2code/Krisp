import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Context / overflow menu anchored to an element. role="menu", arrow keys, Esc closes, click outside closes.

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  anchor: HTMLElement | null;
  label: string;
  items: MenuItem[];
  onClose: () => void;
  /** Extra content under the items (e.g. colour swatches). */
  footer?: ReactNode;
}

export function Menu({ anchor, label, items, onClose, footer }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 180;
    const h = ref.current?.offsetHeight ?? 160;
    setPos({
      left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left)),
      top: r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4,
    });
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    ref.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        anchor.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor]);

  if (!anchor) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="panel fixed z-50 min-w-[180px] rounded-md p-s1"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={(e) => {
        const all = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? [])];
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus(); }
        if (e.key === 'Tab') closeRef.current();
      }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          disabled={it.disabled}
          className={`flex h-8 w-full items-center rounded-sm px-s3 text-left hover:bg-panel-sunken focus-visible:bg-panel-sunken disabled:opacity-40 ${it.danger ? 'text-[#B3261E]' : ''}`}
          onClick={() => {
            closeRef.current();
            it.onSelect();
          }}
        >
          {it.label}
        </button>
      ))}
      {footer}
    </div>,
    document.body,
  );
}

/** Row of colour swatches for Recolor / Change color menus. */
export function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div role="group" aria-label="Recolor" className="flex flex-wrap gap-s2 border-t border-panel-sunken px-s3 pb-s2 pt-s3">
      <span className="label w-full">Recolor</span>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          aria-pressed={c === value}
          className="h-5 w-5 rounded-full"
          style={{ background: c, boxShadow: c === value ? `0 0 0 2px var(--panel), 0 0 0 4px ${c}` : `0 0 4px ${c}` }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}
