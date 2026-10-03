// Tap tempo and position formatting (docs/PRD.md F2).

const TAP_RESET_MS = 2000;
const TAP_WINDOW = 4; // average the last 4 intervals

/** Returns the new tap list and the BPM (null until two taps). Taps older than 2 s reset the sequence. */
export function tapTempo(taps: number[], now: number): { taps: number[]; bpm: number | null } {
  const recent = taps.length && now - taps[taps.length - 1] > TAP_RESET_MS ? [] : taps;
  const next = [...recent, now].slice(-(TAP_WINDOW + 1));
  if (next.length < 2) return { taps: next, bpm: null };
  const intervals = next.slice(1).map((t, i) => t - next[i]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return { taps: next, bpm: Math.round((60000 / avg) * 10) / 10 };
}

/** 0-based tick → "bar.beat.step" (1-based), e.g. tick 0 → "01.1.1". */
export function formatPosition(tick: number): string {
  const t = Math.max(0, tick);
  const bar = Math.floor(t / 16) + 1;
  const beat = Math.floor((t % 16) / 4) + 1;
  const step = (t % 4) + 1;
  return `${String(bar).padStart(2, '0')}.${beat}.${step}`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
