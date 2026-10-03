import { useEffect, useRef } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Meter. 16 LED segments (11 green, 3 amber, 2 red), 1 s peak hold.
// Reads its level through `read()` on animation frames and paints the DOM directly (no React re-render).

export interface MeterProps {
  label: string;
  /** Returns the current level in dB (−Infinity for silence). */
  read: () => number;
  height?: number;
  width?: number;
}

const SEGMENTS = 16;
const FLOOR_DB = -48;
const CEIL_DB = 3;

function colorFor(i: number) {
  return i >= 14 ? 'var(--led-red)' : i >= 11 ? 'var(--led-amber)' : 'var(--led-green)';
}

export function dbToSegments(db: number): number {
  if (!Number.isFinite(db) || db <= FLOOR_DB) return 0;
  return Math.min(SEGMENTS, Math.ceil(((db - FLOOR_DB) / (CEIL_DB - FLOOR_DB)) * SEGMENTS));
}

export function Meter({ label, read, height = 100, width = 6 }: MeterProps) {
  const root = useRef<HTMLDivElement>(null);
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let raf = 0;
    let peak = 0;
    let peakAt = 0;
    let lastLit = -1;
    let lastPeak = -1;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const el = root.current;
      if (el) {
        const db = readRef.current();
        const lit = dbToSegments(db);
        if (lit >= peak || now - peakAt > 1000) {
          peak = lit;
          peakAt = now;
        }
        if (lit !== lastLit || peak !== lastPeak) {
          const segs = el.children;
          for (let i = 0; i < SEGMENTS; i++) {
            const seg = segs[SEGMENTS - 1 - i] as HTMLElement;
            seg.dataset.on = i < lit || (!reduce && i === peak - 1 && peak > 0) ? '1' : '';
          }
          el.setAttribute('aria-valuenow', String(Number.isFinite(db) ? Math.round(db) : FLOOR_DB));
          lastLit = lit;
          lastPeak = peak;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={root}
      role="meter"
      aria-label={label}
      aria-valuemin={FLOOR_DB}
      aria-valuemax={CEIL_DB}
      aria-valuenow={FLOOR_DB}
      className="flex flex-col gap-[2px]"
      style={{ height, width }}
    >
      {Array.from({ length: SEGMENTS }, (_, k) => {
        const i = SEGMENTS - 1 - k;
        return <span key={i} className="meter-seg flex-1 rounded-[1px]" style={{ ['--seg' as string]: colorFor(i) }} />;
      })}
    </div>
  );
}
