import { describe, expect, it } from 'vitest';
import { clampLayout, LAYOUT_DEFAULTS, LAYOUT_LIMITS } from '../src/store/layout';

describe('resizable panel sizes', () => {
  it('falls back to defaults for missing or broken values', () => {
    expect(clampLayout({})).toEqual(LAYOUT_DEFAULTS);
    expect(clampLayout({ rackW: Number.NaN, mixerH: 'tall' as unknown as number })).toEqual(LAYOUT_DEFAULTS);
  });
  it('clamps every size to its limits', () => {
    const s = clampLayout({ rackW: 10, sideW: 9999, songH: 5, mixerH: 99999 });
    expect(s).toEqual({ rackW: LAYOUT_LIMITS.rackW.min, sideW: LAYOUT_LIMITS.sideW.max, songH: LAYOUT_LIMITS.songH.min, mixerH: LAYOUT_LIMITS.mixerH.max });
  });
  it('keeps "fit all lanes" for the Song', () => {
    expect(clampLayout({ songH: null }).songH).toBeNull();
  });
});
