import { memo, useMemo } from 'react';
import { getBuffer, useBufferVersion } from '../../audio/buffers';
import { peaks } from '../../audio/analyze';
import { barSeconds } from '../../audio/scheduler';
import type { AudioClip, Beat, BeatClip, Slot } from '../../model/types';
import { WarningIcon } from '../../ui/icons';

// docs/UI_DESIGN.md → Song clips. Beat clip: Beat colour at 85% with a mini pad map (repeats).
// Audio clip: graphite with waveform in ink-inverse and a warning dot when its length mismatches the bar grid.

export const BAR_W = 48;
export const LANE_H = 52;

/** Mini pad map as one SVG path per velocity level (a full 32-step Beat over 8 bars is thousands of cells). */
export function beatMapPaths(beat: Beat, rack: Slot[], bars: number): { rows: number; h: number; paths: [number, string][] } {
  const rows = rack.filter((s) => beat.steps[s.id]?.some((st) => st.on));
  const cell = BAR_W / 16;
  const h = rows.length ? Math.min(6, (LANE_H - 18) / rows.length) : 0;
  const w = Math.max(1, cell - 1).toFixed(2);
  const hh = Math.max(1, h - 1).toFixed(2);
  const byLevel = new Map<number, string[]>();
  for (let rep = 0; rep * beat.length < bars * 16; rep++) {
    rows.forEach((slot, r) => {
      beat.steps[slot.id].forEach((st, i) => {
        const x = (rep * beat.length + i) * cell;
        if (!st.on || x >= bars * BAR_W) return;
        const level = Math.round((0.35 + (0.65 * st.velocity) / 127) * 100) / 100;
        let parts = byLevel.get(level);
        if (!parts) byLevel.set(level, (parts = []));
        parts.push(`M${(x + 0.5).toFixed(2)} ${(r * h).toFixed(2)}h${w}v${hh}h-${w}z`);
      });
    });
  }
  return { rows: rows.length, h, paths: [...byLevel].map(([level, parts]) => [level, parts.join('')]) };
}

const BeatMap = memo(function BeatMap({ beat, rack, bars }: { beat: Beat; rack: Slot[]; bars: number }) {
  const { rows, h, paths } = useMemo(() => beatMapPaths(beat, rack, bars), [beat, rack, bars]);
  return (
    <svg aria-hidden="true" width={bars * BAR_W} height={rows * h} className="pointer-events-none">
      {paths.map(([level, d]) => <path key={level} d={d} fill="rgba(255,255,255,.85)" opacity={level} />)}
    </svg>
  );
});

function Wave({ clip, bpm }: { clip: AudioClip; bpm: number }) {
  useBufferVersion();
  const buf = getBuffer(clip.soundId, 'LOOP');
  const pts = useMemo(() => (buf ? peaks(buf, 120) : null), [buf]);
  const width = clip.lengthBars * BAR_W;
  if (!pts || !buf) return <div className="mx-s1 h-px w-full bg-ink-inverse opacity-40" />;
  const loopW = (buf.duration / barSeconds(bpm)) * BAR_W;
  const h = LANE_H - 22;
  const paths: string[] = [];
  for (let x0 = 0; x0 < width; x0 += loopW) {
    let d = '';
    pts.forEach((p, i) => {
      const x = x0 + (i / pts.length) * loopW;
      if (x > width) return;
      d += `M${x.toFixed(1)} ${(h / 2 - (p * h) / 2).toFixed(1)}V${(h / 2 + (p * h) / 2).toFixed(1)}`;
    });
    paths.push(d);
  }
  return (
    <svg aria-hidden="true" width={width} height={h} className="pointer-events-none">
      {paths.map((d, i) => <path key={i} d={d} stroke="var(--ink-inverse)" strokeWidth={1} opacity={0.8} />)}
    </svg>
  );
}

export function lengthMismatch(durationMs: number, bpm: number): boolean {
  const sec = durationMs / 1000;
  const bar = barSeconds(bpm);
  const bars = Math.max(1, Math.round(sec / bar));
  return Math.abs(sec - bars * bar) / (bars * bar) > 0.05;
}

export interface ClipViewProps {
  clip: BeatClip | AudioClip;
  beat?: Beat;
  rack: Slot[];
  bpm: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize') => void;
}

export const ClipView = memo(function ClipView({ clip, beat, rack, bpm, selected, onPointerDown }: ClipViewProps) {
  const isBeat = clip.kind === 'beat';
  const name = isBeat ? beat?.name ?? 'Missing beat' : clip.soundName;
  const mismatch = !isBeat && lengthMismatch(clip.durationMs, bpm);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${isBeat ? 'Beat' : 'Audio'} clip ${name}, bar ${clip.startBar + 1}, ${clip.lengthBars} ${clip.lengthBars === 1 ? 'bar' : 'bars'}`}
      data-clip={clip.id}
      className="absolute top-[4px] cursor-grab touch-none select-none overflow-hidden rounded-[8px] active:cursor-grabbing"
      style={{
        left: clip.startBar * BAR_W + 1,
        width: clip.lengthBars * BAR_W - 2,
        height: LANE_H - 8,
        background: isBeat ? `color-mix(in srgb, ${beat?.color ?? '#999'} 85%, transparent)` : 'var(--graphite-2)',
        boxShadow: selected ? '0 0 0 2px var(--led-on), 2px 3px 6px rgba(0,0,0,.25)' : '2px 3px 6px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.3)',
      }}
      onPointerDown={(e) => onPointerDown(e, 'move')}
    >
      <div className="flex items-center gap-s1 px-s2 pt-[3px] text-[10px] font-semibold leading-none" style={{ color: isBeat ? 'rgba(0,0,0,.75)' : 'var(--ink-inverse)' }}>
        <span className="truncate">{name}</span>
        {mismatch && <span title="Loop length does not match the bar grid"><WarningIcon size={11} /></span>}
      </div>
      <div className="mt-[3px] px-[1px]">
        {isBeat && beat ? <BeatMap beat={beat} rack={rack} bars={clip.lengthBars} /> : clip.kind === 'audio' ? <Wave clip={clip} bpm={bpm} /> : null}
      </div>
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 top-0 w-[8px] cursor-ew-resize"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,.15))' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(e, 'resize');
        }}
      />
    </div>
  );
});
