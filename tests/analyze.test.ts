import { describe, expect, it } from 'vitest';
import { canonicalMime, durationMs, normalize, peaks, prepareOneShot, suggestKind, validateUpload, type BufferLike } from '../src/audio/analyze';

function buf(channels: Float32Array[], sampleRate = 1000): BufferLike {
  return { numberOfChannels: channels.length, length: channels[0].length, sampleRate, getChannelData: (c) => channels[c] };
}
const make = (n: number, len: number, sr: number) => buf(Array.from({ length: n }, () => new Float32Array(len)), sr);
const peak = (b: BufferLike) => Math.max(...Array.from({ length: b.numberOfChannels }, (_, c) => Math.max(...b.getChannelData(c).map(Math.abs))));

describe('analyze', () => {
  it('suggestKind threshold at 2000 ms', () => {
    expect(suggestKind(2000)).toBe('ONE_SHOT');
    expect(suggestKind(2001)).toBe('LOOP');
    expect(suggestKind(3000)).toBe('LOOP');
  });

  it('durationMs', () => {
    expect(durationMs({ length: 44100 * 3, sampleRate: 44100 })).toBe(3000);
  });

  it('normalize peaks to −1 dBFS', () => {
    const d = new Float32Array([0, 0.25, -0.5, 0.1]);
    normalize(buf([d]));
    expect(peak(buf([d]))).toBeCloseTo(Math.pow(10, -1 / 20), 4);
  });

  it('normalize leaves silence unchanged', () => {
    const d = new Float32Array(10);
    normalize(buf([d]));
    expect(peak(buf([d]))).toBe(0);
  });

  it('prepareOneShot trims silence (keeps 2 ms pre-roll), fades and normalizes', () => {
    const sr = 1000; // 1 sample = 1 ms
    const d = new Float32Array(1000);
    for (let i = 300; i < 600; i++) d[i] = 0.3 * Math.sin(i);
    d[300] = 0.3;
    const out = prepareOneShot(buf([d], sr), make);
    expect(out.length).toBe(600 - 298); // starts 2 samples before the first audible sample
    expect(out.getChannelData(0)[0]).toBe(0); // fade-in starts at 0
    expect(out.getChannelData(0)[out.length - 1]).toBe(0); // fade-out ends at 0
    expect(peak(out)).toBeCloseTo(Math.pow(10, -1 / 20), 3);
  });

  it('prepareOneShot ignores content below −45 dBFS', () => {
    const d = new Float32Array(200).fill(0.001); // −60 dBFS
    d[100] = 0.5;
    const out = prepareOneShot(buf([d]), make);
    expect(out.length).toBe(3); // 2 ms pre-roll + the single loud sample
  });

  it('peaks returns max abs per bucket', () => {
    const d = new Float32Array([0.1, -0.9, 0.2, 0.3]);
    expect(peaks(buf([d]), 2).map((v) => Number(v.toFixed(2)))).toEqual([0.9, 0.3]);
  });

  it('validates uploads by type and size', () => {
    expect(validateUpload({ type: 'audio/wav', size: 1000, name: 'a.wav' })).toBeNull();
    expect(validateUpload({ type: '', size: 1000, name: 'loop.mp3' })).toBeNull();
    expect(validateUpload({ type: 'audio/flac', size: 1000, name: 'a.flac' })).toMatch(/WAV, MP3 or OGG/);
    expect(validateUpload({ type: 'audio/wav', size: 3 * 1024 * 1024 + 1, name: 'a.wav' })).toMatch(/3 MB/);
  });

  it('canonical mime', () => {
    expect(canonicalMime('audio/x-wav')).toBe('audio/wav');
    expect(canonicalMime('audio/mp3')).toBe('audio/mpeg');
    expect(canonicalMime('video/mp4')).toBeNull();
  });
});
