import { useRef, useState } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Splitter. A grip between two panels: drag to resize, double-click resets,
// arrow keys move 16 px (Shift 64 px), Home/End jump to the limits.

export interface SplitterProps {
  label: string;
  /** 'x' sits between columns and changes a width; 'y' sits between rows and changes a height. */
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  /** +1: moving right/down grows the value; −1: moving left/up grows it (e.g. a drawer pulled up). */
  direction?: 1 | -1;
  onChange: (v: number) => void;
  onReset?: () => void;
  className?: string;
}

export function Splitter({ label, axis, value, min, max, direction = 1, onChange, onReset, className = '' }: SplitterProps) {
  const st = useRef<{ start: number; value: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const pos = (e: { clientX: number; clientY: number }) => (axis === 'x' ? e.clientX : e.clientY);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      title={`${label} — drag to resize, double-click to reset`}
      data-dragging={dragging || undefined}
      className={`splitter group relative flex shrink-0 touch-none select-none items-center justify-center ${axis === 'x' ? 'cursor-col-resize' : 'cursor-row-resize'} ${className}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        st.current = { start: pos(e), value, id: e.pointerId };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s || s.id !== e.pointerId) return;
        onChange(clamp(s.value + (pos(e) - s.start) * direction));
      }}
      onPointerUp={(e) => {
        if (st.current?.id !== e.pointerId) return;
        st.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        st.current = null;
        setDragging(false);
      }}
      onDoubleClick={() => onReset?.()}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        const grow = axis === 'x' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
        const d = grow[e.key as keyof typeof grow];
        if (d !== undefined) {
          e.preventDefault();
          onChange(clamp(value + d * direction * step));
        } else if (e.key === 'Home') {
          e.preventDefault();
          onChange(min);
        } else if (e.key === 'End') {
          e.preventDefault();
          onChange(max);
        } else if (e.key === 'Enter' && onReset) {
          e.preventDefault();
          onReset();
        }
      }}
    >
      <span aria-hidden="true" className={`splitter-grip rounded-full ${axis === 'x' ? 'h-10 w-[4px]' : 'h-[4px] w-10'}`} />
    </div>
  );
}
