import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Vertical drag helper for Lcd (Fader has its own): 150 px = full range by default, Shift = ×0.2.
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

/** Signed shortest turn from angle `a` to angle `b`, in degrees (−180 … 180). */
export function angleDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/** Pointer angle around a centre in knob degrees: 0 = up, clockwise positive. */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
}

/** Value after turning a knob by `deltaDeg`; `sweep` degrees = full range. */
export function rotaryStep(value: number, deltaDeg: number, min: number, max: number, sweep: number, scale = 1): number {
  return Math.min(max, Math.max(min, value + (deltaDeg / sweep) * (max - min) * scale));
}

// Rotary drag for Knob: the value follows the pointer turning around the knob centre (relative, so a click
// never jumps the value). The pointer is captured, so the circle can be drawn outside the knob. Shift = ×0.2.
// Near the centre the angle is unstable (crossing it flips 180°), so the reference re-syncs on the way out.
const DEAD_ZONE_PX = 6;

export function useRotaryDrag(opts: DragOptions & { sweep: number }) {
  const st = useRef<{ cx: number; cy: number; angle: number; v: number; turned: number; id: number; resync: boolean } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      const o = optsRef.current;
      if (o.disabled || e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.focus();
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      st.current = { cx, cy, angle: pointerAngle(cx, cy, e.clientX, e.clientY), v: o.value, turned: 0, id: e.pointerId,
        resync: Math.hypot(e.clientX - cx, e.clientY - cy) < DEAD_ZONE_PX };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - s.cx, e.clientY - s.cy) < DEAD_ZONE_PX) {
        s.resync = true;
        return;
      }
      const o = optsRef.current;
      const angle = pointerAngle(s.cx, s.cy, e.clientX, e.clientY);
      if (s.resync) {
        s.resync = false;
        s.angle = angle;
        return;
      }
      const d = angleDelta(s.angle, angle);
      s.angle = angle;
      s.turned += Math.abs(d);
      if (s.turned < 2) return;
      s.v = rotaryStep(s.v, d, o.min, o.max, o.sweep, e.shiftKey ? 0.2 : 1);
      o.onChange(s.v);
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      st.current = null;
      if (s.turned >= 2) optsRef.current.onEnd?.();
      else optsRef.current.onTap?.();
    },
    onPointerCancel() {
      if (st.current && st.current.turned >= 2) optsRef.current.onEnd?.();
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
