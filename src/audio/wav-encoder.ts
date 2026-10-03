// 16-bit PCM WAV encoder: interleaved channels, RIFF header (docs/TRD.md → EXPORT).

export interface PcmSource {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export function encodeWav(src: PcmSource): ArrayBuffer {
  const channels = src.numberOfChannels;
  const frames = src.length;
  const bytesPerSample = 2;
  const dataBytes = frames * channels * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // format = PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, src.sampleRate, true);
  v.setUint32(28, src.sampleRate * channels * bytesPerSample, true); // byte rate
  v.setUint16(32, channels * bytesPerSample, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  const data = Array.from({ length: channels }, (_, c) => src.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      o += 2;
    }
  }
  return buf;
}
