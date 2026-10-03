import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/audio/wav-encoder';

const src = (channels: Float32Array[], sampleRate = 44100) => ({
  numberOfChannels: channels.length,
  length: channels[0].length,
  sampleRate,
  getChannelData: (c: number) => channels[c],
});
const str = (v: DataView, o: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(o + i)));

describe('encodeWav', () => {
  const L = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
  const R = new Float32Array([0, -0.25, 0.25, 0, 0, -2]);
  const buf = encodeWav(src([L, R]));
  const v = new DataView(buf);

  it('writes a valid RIFF/WAVE PCM header', () => {
    expect(str(v, 0, 4)).toBe('RIFF');
    expect(str(v, 8, 4)).toBe('WAVE');
    expect(str(v, 12, 4)).toBe('fmt ');
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(44100 * 4);
    expect(v.getUint16(32, true)).toBe(4);
    expect(v.getUint16(34, true)).toBe(16);
    expect(str(v, 36, 4)).toBe('data');
  });

  it('has the correct lengths', () => {
    expect(buf.byteLength).toBe(44 + 6 * 2 * 2);
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8);
    expect(v.getUint32(40, true)).toBe(6 * 2 * 2);
  });

  it('interleaves and clips samples to 16-bit', () => {
    const s = (frame: number, ch: number) => v.getInt16(44 + (frame * 2 + ch) * 2, true);
    expect(s(1, 0)).toBe(Math.round(0.5 * 0x7fff));
    expect(s(1, 1)).toBe(Math.round(-0.25 * 0x8000));
    expect(s(3, 0)).toBe(32767);
    expect(s(4, 0)).toBe(-32768);
    expect(s(5, 0)).toBe(32767); // clipped
    expect(s(5, 1)).toBe(-32768); // clipped
  });
});
