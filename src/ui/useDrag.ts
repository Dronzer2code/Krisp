import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Vertical drag helper for Knob / Fader / Lcd: 150 px = full range by default, Shift = ×0.2.
// onChange fires during the drag; onEnd fires once on release (store coalesces into one undo entry).

export interface DragOptions {
  value: number;
  min: number;
  max: number;
  pixels?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onEnd?: () => void;
  /** Called on a click without movement (e.g. Lcd enters typing mode). */
  onTap?: () => void;
}

export function useVerticalDrag(opts: DragOptions) {
  const st = useRef<{ y: number; v: number; moved: boolean; id: number } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      const o = optsRef.current;
      if (o.disabled || e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      st.current = { y: e.clientY, v: o.value, moved: false, id: e.pointerId };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      const o = optsRef.current;
      const dy = s.y - e.clientY;
      if (Math.abs(dy) > 2) s.moved = true;
      if (!s.moved) return;
      const range = o.max - o.min;
      const scale = e.shiftKey ? 0.2 : 1;
      const next = Math.min(o.max, Math.max(o.min, s.v + (dy / (o.pixels ?? 150)) * range * scale));
      o.onChange(next);
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      st.current = null;
      const o = optsRef.current;
      if (s.moved) o.onEnd?.();
      else o.onTap?.();
    },
    onPointerCancel() {
      if (st.current?.moved) optsRef.current.onEnd?.();
      st.current = null;
    },
  };
}

/** Keyboard stepping shared by sliders: arrows 1%, PageUp/Down 10%, Home/End. Returns the new value or null. */
export function keyStep(key: string, value: number, min: number, max: number, fine = (max - min) / 100): number | null {
  const big = (max - min) / 10;
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return Math.min(max, value + fine);
    case 'ArrowDown':
    case 'ArrowLeft':
      return Math.max(min, value - fine);
    case 'PageUp':
      return Math.min(max, value + big);
    case 'PageDown':
      return Math.max(min, value - big);
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }
}
