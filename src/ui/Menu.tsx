import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Context / overflow menu anchored to an element. role="menu", arrow keys, Esc closes, click outside closes.
// Items with `submenu` open a nested menu to the side (click, hover, or →; ← / Esc closes it).

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Nested items, e.g. "Add to playlist ▸". */
  submenu?: MenuItem[];
}

export interface MenuProps {
  anchor: HTMLElement | null;
  label: string;
  items: MenuItem[];
  onClose: () => void;
  /** Extra content under the items (e.g. colour swatches). */
  footer?: ReactNode;
  /** 'below' (default) for buttons; 'side' for submenus. */
  placement?: 'below' | 'side';
}

export function Menu({ anchor, label, items, onClose, footer, placement = 'below' }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  const [sub, setSub] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 180;
    const h = ref.current?.offsetHeight ?? 160;
    if (placement === 'side') {
      const right = r.right + 2 + w <= window.innerWidth - 8;
      setPos({
        left: right ? r.right + 2 : Math.max(8, r.left - w - 2),
        top: Math.max(8, Math.min(window.innerHeight - h - 8, r.top - 4)),
      });
    } else {
      setPos({
        left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left)),
        top: r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4,
      });
    }
  }, [anchor, placement, items.length]);

  useEffect(() => {
    if (!anchor) return;
    ref.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      // Clicks inside any open menu (this one or a submenu) are handled by that menu.
      if (t.closest?.('[role=menu]') || anchor.contains(t)) return;
      closeRef.current();
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
  const openSub = sub ? items[sub.index]?.submenu : undefined;
  return createPortal(
    <>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className="panel fixed z-50 min-w-[180px] max-w-[280px] rounded-md p-s1"
        style={{ left: pos.left, top: pos.top }}
        onKeyDown={(e) => {
          const all = [...(ref.current?.querySelectorAll<HTMLElement>(':scope > [role=menuitem]:not([disabled])') ?? [])];
          const i = all.indexOf(document.activeElement as HTMLElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus(); }
          if (e.key === 'ArrowLeft' && placement === 'side') { e.preventDefault(); closeRef.current(); anchor.focus(); }
          if (e.key === 'Tab') closeRef.current();
        }}
      >
        {items.map((it, i) => (
          <button
            key={`${i}:${it.label}`} // labels can repeat (two Slots named "New slot")
            type="button"
            role="menuitem"
            aria-haspopup={it.submenu ? 'menu' : undefined}
            aria-expanded={it.submenu ? sub?.index === i : undefined}
            disabled={it.disabled}
            className={`flex h-8 w-full items-center gap-s2 rounded-sm px-s3 text-left hover:bg-panel-sunken focus-visible:bg-panel-sunken disabled:opacity-40 ${it.danger ? 'text-[#B3261E]' : ''} ${sub?.index === i ? 'bg-panel-sunken' : ''}`}
            onPointerEnter={(e) => {
              if (it.submenu && !it.disabled) setSub({ index: i, anchor: e.currentTarget });
              else if (sub) setSub(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && it.submenu) {
                e.preventDefault();
                e.stopPropagation();
                setSub({ index: i, anchor: e.currentTarget });
              }
            }}
            onClick={(e) => {
              if (it.submenu) {
                setSub({ index: i, anchor: e.currentTarget });
                return;
              }
              closeRef.current();
              it.onSelect?.();
            }}
          >
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.submenu && <span aria-hidden="true" className="text-ink-soft">▸</span>}
          </button>
        ))}
        {footer}
      </div>
      {openSub && sub && (
        <Menu
          anchor={sub.anchor}
          label={items[sub.index].label}
          placement="side"
          onClose={() => setSub(null)}
          items={openSub.map((si) => ({
            ...si,
            onSelect: si.onSelect
              ? () => {
                  closeRef.current();
                  si.onSelect?.();
                }
              : undefined,
          }))}
        />
      )}
    </>,
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
