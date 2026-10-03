import { useRef, useState } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Fader. Vertical, dB scale with marks +6 0 −6 −12 −24 −48 −∞.

export const FADER_MIN_DB = -60; // shown as −∞
export const FADER_MAX_DB = 6;

// Position (0 bottom … 1 top) ↔ dB, piecewise linear between marks.
const MAP: [number, number][] = [
  [0, FADER_MIN_DB], [0.1, -48], [0.32, -24], [0.5, -12], [0.66, -6], [0.82, 0], [1, 6],
];

export function dbToPos(db: number): number {
  if (db <= FADER_MIN_DB) return 0;
  for (let i = 1; i < MAP.length; i++) {
    const [p0, d0] = MAP[i - 1];
    const [p1, d1] = MAP[i];
    if (db <= d1) return p0 + ((db - d0) / (d1 - d0)) * (p1 - p0);
  }
  return 1;
}

export function posToDb(pos: number): number {
  if (pos <= 0) return FADER_MIN_DB;
  for (let i = 1; i < MAP.length; i++) {
    const [p0, d0] = MAP[i - 1];
    const [p1, d1] = MAP[i];
    if (pos <= p1) return d0 + ((pos - p0) / (p1 - p0)) * (d1 - d0);
  }
  return FADER_MAX_DB;
}

export const formatDb = (db: number) => (db <= FADER_MIN_DB ? '−∞' : `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`);

export interface FaderProps {
  label: string;
  valueDb: number;
  height?: number;
  disabled?: boolean;
  onChange: (db: number) => void;
  onChangeEnd?: () => void;
}

const MARKS = [6, 0, -6, -12, -24, -48, FADER_MIN_DB];
const CAP_H = 34;

export function Fader({ label, valueDb, height = 140, disabled, onChange, onChangeEnd }: FaderProps) {
  const track = height - CAP_H;
  const pos = dbToPos(valueDb);
  const st = useRef<{ y: number; pos: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const round = (db: number) => (db <= FADER_MIN_DB + 0.05 ? FADER_MIN_DB : Math.round(db * 10) / 10);

  const commit = (db: number) => {
    onChange(round(Math.min(FADER_MAX_DB, Math.max(FADER_MIN_DB, db))));
    onChangeEnd?.();
  };

  return (
    <div className="flex select-none flex-col items-center gap-s1" style={{ opacity: disabled ? 0.45 : 1 }}>
      <div className="relative flex" style={{ height }}>
        <div className="relative mr-[3px]" style={{ height, width: 18 }} aria-hidden="true">
          {MARKS.map((m) => (
            <span key={m} className="absolute right-0 font-display text-[8px] leading-none text-ink-soft" style={{ top: CAP_H / 2 + (1 - dbToPos(m)) * track - 4 }}>
              {m <= FADER_MIN_DB ? '−∞' : m > 0 ? `+${m}` : m}
            </span>
          ))}
        </div>
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-orientation="vertical"
          aria-valuemin={FADER_MIN_DB}
          aria-valuemax={FADER_MAX_DB}
          aria-valuenow={Number(valueDb.toFixed(1))}
          aria-valuetext={formatDb(valueDb)}
          className="fader relative w-[26px] cursor-ns-resize touch-none"
          style={{ height }}
          onPointerDown={(e) => {
            if (disabled || e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            st.current = { y: e.clientY, pos, id: e.pointerId };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            const s = st.current;
            if (!s || s.id !== e.pointerId) return;
            const scale = e.shiftKey ? 0.2 : 1;
            const p = Math.min(1, Math.max(0, s.pos + ((s.y - e.clientY) / track) * scale));
            onChange(round(posToDb(p)));
          }}
          onPointerUp={(e) => {
            if (st.current?.id !== e.pointerId) return;
            st.current = null;
            setDragging(false);
            onChangeEnd?.();
          }}
          onPointerCancel={() => {
            st.current = null;
            setDragging(false);
            onChangeEnd?.();
          }}
          onDoubleClick={() => !disabled && commit(0)}
          onWheel={(e) => {
            if (disabled) return;
            e.preventDefault();
            commit(posToDb(Math.min(1, Math.max(0, pos - Math.sign(e.deltaY) * 0.02))));
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const d = { ArrowUp: 0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowLeft: -0.5, PageUp: 6, PageDown: -6 }[e.key];
            if (d !== undefined) {
              e.preventDefault();
              commit((valueDb <= FADER_MIN_DB && d > 0 ? -48 : valueDb) + d);
            } else if (e.key === 'Home') commit(FADER_MIN_DB);
            else if (e.key === 'End') commit(FADER_MAX_DB);
          }}
        >
          <span className="absolute left-1/2 w-[6px] -translate-x-1/2 rounded-full bg-panel-sunken shadow-sunken" style={{ top: CAP_H / 2, height: track }} />
          <span className="fader-cap absolute left-0 flex h-[34px] w-[26px] flex-col items-center justify-center gap-[3px] rounded-[6px]" style={{ top: (1 - pos) * track }}>
            <i className="h-px w-3 bg-ink-soft" />
            <i className="h-[2px] w-4 bg-ink" />
            <i className="h-px w-3 bg-ink-soft" />
          </span>
          {dragging && <span role="tooltip" className="lcd-tip absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">{formatDb(valueDb)}</span>}
        </div>
      </div>
      <span className="label">{label}</span>
    </div>
  );
}
