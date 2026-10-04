import { useRef, useState } from 'react';
import { keyStep, useRotaryDrag } from './useDrag';

// docs/UI_DESIGN.md → PRIMITIVES → Knob. 270° travel, value arc in --led-on, 11 ticks.
// Every knob turns by circling the pointer around it (useRotaryDrag); never by vertical drag.

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  size?: 'md' | 'sm';
  /** Bipolar knobs draw the value arc from the centre (pan, EQ, tune). */
  bipolar?: boolean;
  format?: (v: number) => string;
  /** Snap to this increment (e.g. 1 for semitones). */
  step?: number;
  disabled?: boolean;
  hideLabel?: boolean;
  /** Short visible label (e.g. "HI"); `label` stays the accessible name. */
  shortLabel?: string;
  onChange: (v: number) => void;
  onChangeEnd?: () => void;
}

const START = -135;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  if (Math.abs(to - from) < 0.01) return '';
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

export function Knob({
  label, value, min, max, defaultValue, size = 'md', bipolar = false, format = (v) => v.toFixed(2), step, disabled, hideLabel, shortLabel,
  onChange, onChangeEnd,
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const px = size === 'sm' ? 28 : 36;
  const box = px + (size === 'sm' ? 8 : 10);
  const c = box / 2;
  const snap = (v: number) => (step ? Math.round(v / step) * step : v);
  const norm = (Math.min(max, Math.max(min, value)) - min) / (max - min || 1);
  const angle = START + norm * SWEEP;
  const zeroAngle = bipolar ? START + ((0 - min) / (max - min)) * SWEEP : START;
  const lastEmitted = useRef(value);

  const emit = (v: number) => {
    const s = snap(v);
    if (s !== lastEmitted.current) {
      lastEmitted.current = s;
      onChange(s);
    }
  };

  const drag = useRotaryDrag({
    value, min, max, disabled, sweep: SWEEP,
    onChange: (v) => {
      setDragging(true);
      emit(v);
    },
    onEnd: () => {
      setDragging(false);
      onChangeEnd?.();
    },
  });

  const commit = (v: number) => {
    lastEmitted.current = value;
    emit(v);
    onChangeEnd?.();
  };

  return (
    <div className="flex select-none flex-col items-center gap-[2px]" style={{ opacity: disabled ? 0.45 : 1 }}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={format(value)}
        aria-disabled={disabled || undefined}
        className={`knob relative touch-none rounded-full ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        title={dragging ? undefined : `${label}: ${format(value)}`}
        style={{ width: box, height: box }}
        {...drag}
        onDoubleClick={() => defaultValue !== undefined && !disabled && commit(defaultValue)}
        onWheel={(e) => {
          if (disabled) return;
          e.preventDefault();
          commit(Math.min(max, Math.max(min, value - Math.sign(e.deltaY) * ((max - min) / 50))));
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const next = keyStep(e.key, value, min, max, step ?? (max - min) / 100);
          if (next !== null) {
            e.preventDefault();
            commit(next);
          }
        }}
      >
        <svg width={box} height={box} aria-hidden="true" className="absolute inset-0">
          {Array.from({ length: 11 }, (_, i) => {
            const a = START + (i / 10) * SWEEP;
            const [x1, y1] = polar(c, c, box / 2 - 0.5, a);
            const [x2, y2] = polar(c, c, box / 2 - 2.5, a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-soft)" strokeWidth={0.8} opacity={0.6} />;
          })}
          <path d={arc(c, c, px / 2 + 1, START, START + SWEEP)} stroke="var(--panel-sunken)" strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d={arc(c, c, px / 2 + 1, Math.min(zeroAngle, angle), Math.max(zeroAngle, angle))} stroke="var(--led-on)" strokeWidth={3} fill="none" strokeLinecap="round" />
        </svg>
        <div
          className="knob-cap absolute rounded-full"
          style={{ left: (box - px + 6) / 2, top: (box - px + 6) / 2, width: px - 6, height: px - 6, transform: `rotate(${angle}deg)` }}
        >
          <span className="absolute left-1/2 top-[3px] h-[35%] w-[2px] -translate-x-1/2 rounded-full bg-ink" />
        </div>
        {dragging && <span role="tooltip" className="lcd-tip absolute -top-6 left-1/2 -translate-x-1/2">{format(value)}</span>}
      </div>
      {!hideLabel && <span className="label whitespace-nowrap">{shortLabel ?? label}</span>}
    </div>
  );
}
