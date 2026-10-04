import { describe, expect, it } from 'vitest';
import { angleDelta, pointerAngle, rotaryStep } from '../src/ui/useDrag';
import { dbToPos, posToDb, roundDb } from '../src/ui/Fader';
import { knobCenter, knobPos, knobValue } from '../src/ui/Knob';

describe('rotary knob drag', () => {
  it('measures pointer angle clockwise from 12 o’clock', () => {
    expect(pointerAngle(0, 0, 0, -10)).toBeCloseTo(0); // up
    expect(pointerAngle(0, 0, 10, 0)).toBeCloseTo(90); // right
    expect(pointerAngle(0, 0, -10, 0)).toBeCloseTo(-90); // left
    expect(Math.abs(pointerAngle(0, 0, 0, 10))).toBeCloseTo(180); // down
  });

  it('takes the shortest turn across the ±180° seam', () => {
    expect(angleDelta(170, -170)).toBeCloseTo(20);
    expect(angleDelta(-170, 170)).toBeCloseTo(-20);
    expect(angleDelta(10, 40)).toBeCloseTo(30);
    expect(angleDelta(40, 10)).toBeCloseTo(-30);
  });

  it('turning clockwise raises the value; 270° = full range; clamps at the ends', () => {
    expect(rotaryStep(0, 135, 0, 1, 270)).toBeCloseTo(0.5);
    expect(rotaryStep(0.5, -135, 0, 1, 270)).toBeCloseTo(0);
    expect(rotaryStep(0.9, 90, 0, 1, 270)).toBe(1);
    expect(rotaryStep(-12, -400, -12, 12, 270)).toBe(-12);
    expect(rotaryStep(0, 135, 0, 1, 270, 0.2)).toBeCloseTo(0.1); // Shift = fine
  });

  it('a full clockwise circle of small moves sweeps the whole range', () => {
    let v = 0;
    let prev = pointerAngle(0, 0, -10, 10); // start at 7:30, like the knob's minimum
    for (let i = 1; i <= 27; i++) {
      const a = prev + 10;
      v = rotaryStep(v, angleDelta(prev, a), 0, 1, 270);
      prev = a;
    }
    expect(v).toBeCloseTo(1);
  });
});

describe('volume knob mapping', () => {
  it('shares the fader dB curve', () => {
    expect(posToDb(dbToPos(0))).toBeCloseTo(0);
    expect(posToDb(dbToPos(-12))).toBeCloseTo(-12);
    expect(roundDb(posToDb(0))).toBe(-60);
    expect(roundDb(-3.04)).toBe(-3);
  });
});

describe('knob centring (default at 12 o’clock)', () => {
  it('centres only a default strictly inside the range', () => {
    expect(knobCenter(-12, 12, 0)).toBe(0);
    expect(knobCenter(0, 0.6, 0)).toBeUndefined(); // swing: default = min, stays at 7:30
    expect(knobCenter(0, 1)).toBeUndefined();
  });

  it('maps each half of the turn onto its own half of the range', () => {
    // Compressor ratio 1…20, default 3: 1 → 7:30, 3 → 12 o’clock, 20 → 4:30
    expect(knobPos(1, 1, 20, 3)).toBe(0);
    expect(knobPos(3, 1, 20, 3)).toBe(0.5);
    expect(knobPos(20, 1, 20, 3)).toBe(1);
    expect(knobPos(2, 1, 20, 3)).toBeCloseTo(0.25);
    expect(knobValue(0.75, 1, 20, 3)).toBeCloseTo(11.5);
    for (const v of [1, 2.2, 3, 7, 19.9]) expect(knobValue(knobPos(v, 1, 20, 3), 1, 20, 3)).toBeCloseTo(v);
  });

  it('volume: 0 dB points up, right half = 0…+6 dB, left half = −∞…0 dB', () => {
    const c = knobCenter(0, 1, dbToPos(0));
    expect(knobPos(dbToPos(0), 0, 1, c)).toBeCloseTo(0.5);
    expect(roundDb(posToDb(knobValue(1, 0, 1, c)))).toBe(6);
    expect(roundDb(posToDb(knobValue(0, 0, 1, c)))).toBe(-60);
    expect(posToDb(knobValue(0.5 + 45 / 270, 0, 1, c))).toBeCloseTo(2); // 45° right of top
  });

  it('a knob without a centre stays linear', () => {
    expect(knobPos(0.3, 0, 0.6)).toBeCloseTo(0.5);
    expect(knobValue(0.5, 0, 0.6)).toBeCloseTo(0.3);
  });
});
