import { describe, expect, it } from 'vitest';
import { formatClock, formatPosition, tapTempo } from '../src/model/time';

describe('tap tempo (AC-F2.1)', () => {
  it('four taps 0.5 s apart set 120 BPM', () => {
    let taps: number[] = [];
    let bpm: number | null = null;
    for (const t of [1000, 1500, 2000, 2500]) ({ taps, bpm } = tapTempo(taps, t));
    expect(bpm).not.toBeNull();
    expect(Math.abs(bpm! - 120)).toBeLessThanOrEqual(1);
  });

  it('needs two taps', () => {
    expect(tapTempo([], 0).bpm).toBeNull();
  });

  it('resets after a 2 s pause', () => {
    let { taps } = tapTempo([], 0);
    ({ taps } = tapTempo(taps, 400));
    const r = tapTempo(taps, 5000);
    expect(r.taps).toEqual([5000]);
    expect(r.bpm).toBeNull();
  });
});

describe('position', () => {
  it('formats bar.beat.step', () => {
    expect(formatPosition(0)).toBe('01.1.1');
    expect(formatPosition(5)).toBe('01.2.2');
    expect(formatPosition(16 * 2 + 15)).toBe('03.4.4');
  });
  it('formats mm:ss', () => {
    expect(formatClock(41.9)).toBe('00:41');
    expect(formatClock(125)).toBe('02:05');
  });
});

import { padGeometry } from '../src/screens/workspace/BeatEditor';

describe('padGeometry (pads fill the Beat Editor row)', () => {
  it('stretches width to the free space, caps height at 40 so rows stay 44 px', () => {
    const g = padGeometry(1200, 16, 22);
    expect(g.h).toBe(40);
    expect(16 * g.w + 15 * 4 + 3 * 6).toBeLessThanOrEqual(1200);
    expect(16 * (g.w + 1) + 15 * 4 + 3 * 6).toBeGreaterThan(1200);
  });
  it('stays square below 40 px and never under the minimum (then scrolls)', () => {
    expect(padGeometry(500, 16, 22)).toEqual({ w: 26, h: 26 });
    expect(padGeometry(300, 32, 22)).toEqual({ w: 22, h: 22 });
  });
});
