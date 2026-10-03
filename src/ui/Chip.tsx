import { useRef } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Chip. Raised pill with colour dot; context menu via right-click,
// long-press or Shift+F10. Lives in a role="tablist" container.

export interface ChipProps {
  name: string;
  color: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onContextMenu?: (anchor: HTMLElement) => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

export function Chip({ name, color, selected, disabled, onSelect, onContextMenu, draggable, onDragStart, onKeyDown }: ChipProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={!!selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className="chip inline-flex h-[26px] shrink-0 items-center gap-s2 rounded-full px-s3"
      data-selected={selected || undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onSelect}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(e.currentTarget);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch' || !onContextMenu) return;
        clear();
        timer.current = window.setTimeout(() => ref.current && onContextMenu(ref.current), 500);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onKeyDown={(e) => {
        if (e.key === 'F10' && e.shiftKey && onContextMenu) {
          e.preventDefault();
          onContextMenu(e.currentTarget);
          return;
        }
        if (e.key === 'ContextMenu' && onContextMenu) {
          e.preventDefault();
          onContextMenu(e.currentTarget);
          return;
        }
        onKeyDown?.(e);
      }}
    >
      <span aria-hidden="true" className="h-[8px] w-[8px] rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
      <span className="max-w-[120px] truncate">{name}</span>
    </button>
  );
}
