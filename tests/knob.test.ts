import { describe, expect, it } from 'vitest';
import { angleDelta, pointerAngle, rotaryStep } from '../src/ui/useDrag';
import { dbToPos, posToDb, roundDb } from '../src/ui/Fader';

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
