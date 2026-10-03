import { forwardRef, memo, useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Pad. Off: sunken graphite. On: Slot colour with glow ∝ velocity.
// Interaction (toggle, paint, velocity cycle, long-press) is coordinated by the grid; the Pad reports events.

export interface PadProps {
  label: string;
  on: boolean;
  velocity: number;
  color: string;
  /** Microtiming offset (−0.5..0.5 step), drawn as a tick. */
  offset?: number;
  size?: number;
  disabled?: boolean;
  tabIndex?: number;
  /** Grid coordinates written as data-cell / data-col (playhead + flash are applied via the DOM). */
  cell?: string;
  col?: number;
  /** Start of a press: grid decides toggle vs paint. `cycle` = Shift held. */
  onPress?: (e: { cycle: boolean; pointerId: number; pointerType: string }) => void;
  onEnter?: () => void;
  onLongPress?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus?: () => void;
}

export const Pad = memo(
  forwardRef<HTMLButtonElement, PadProps>(function Pad(
    { label, on, velocity, color, offset = 0, size = 34, disabled, tabIndex, cell, col, onPress, onEnter, onLongPress, onKeyDown, onFocus },
    ref,
  ) {
    const timer = useRef<number | null>(null);
    const clear = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    const level = on ? Math.max(0.25, velocity / 127) : 0;
    return (
      <button
        ref={ref}
        type="button"
        className="pad relative shrink-0 touch-none"
        data-on={on || undefined}
        data-cell={cell}
        data-col={col}
        aria-pressed={on}
        aria-label={label}
        disabled={disabled}
        tabIndex={tabIndex}
        style={{
          width: size,
          height: size,
          ['--pad-color' as string]: color,
          ['--pad-level' as string]: level,
        }}
        onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
          if (e.button !== 0 || disabled) return;
          e.preventDefault();
          // Release implicit capture so pointerenter fires on neighbouring pads (drag-paint).
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          onPress?.({ cycle: e.shiftKey, pointerId: e.pointerId, pointerType: e.pointerType });
          if (e.pointerType === 'touch' && onLongPress) {
            clear();
            timer.current = window.setTimeout(() => {
              timer.current = null;
              onLongPress();
            }, 400);
          }
        }}
        // Mouse clicks do not move focus to the pad, so Space keeps meaning Play/Stop (keyboard users Tab in).
        onMouseDown={(e) => e.preventDefault()}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onPointerEnter={(e) => {
          if (e.buttons & 1) onEnter?.();
        }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onContextMenu={(e) => e.preventDefault()}
      >
        {on && Math.abs(offset) > 0.02 && (
          <span aria-hidden="true" className="pad-tick absolute bottom-[4px] h-[3px] w-[3px] rounded-full" style={{ left: `calc(50% + ${offset * 70}% - 1.5px)` }} />
        )}
      </button>
    );
  }),
);
