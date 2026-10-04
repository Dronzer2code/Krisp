import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { loadBuffer } from '../../audio/buffers';
import { getPlayhead, subscribePlayhead } from '../../audio/playhead';
import { barSeconds } from '../../audio/scheduler';
import type { Clip, Id, Lane } from '../../model/types';
import { SONG_BARS_MAX } from '../../model/types';
import { beatBars } from '../../store/ops';
import { LAYOUT_LIMITS, useLayout } from '../../store/layout';
import { useUi } from '../../store/ui';
import { actions, useWorkspace } from '../../store/workspace';
import { Lcd } from '../../ui/Lcd';
import { PlusIcon } from '../../ui/icons';
import { Splitter } from '../../ui/Splitter';
import { BAR_W, ClipView } from './ClipView';
import { BEAT_DRAG_TYPE, SOUND_DRAG_TYPE, type SoundDragPayload } from './dnd';
import { HEADER_W, LaneRow } from './LaneRow';

// docs/PRD.md F5; docs/PROCESS_FLOW.md J7; docs/UI_DESIGN.md → Song.

const RULER_H = 24;
const EXTRA_BARS = 8; // room to drop past the end

interface Drag {
  clipId: Id;
  mode: 'move' | 'resize';
  x: number;
  startBar: number;
  lengthBars: number;
  laneType: Lane['type'];
  pointerId: number;
}

function Ruler({ bars, loop }: { bars: number; loop: { enabled: boolean; startBar: number; endBar: number } }) {
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const from = useRef<number | null>(null);
  const barAt = (e: ReactPointerEvent<HTMLDivElement>) =>
    Math.max(0, Math.min(SONG_BARS_MAX - 1, Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / BAR_W)));
  const shown = sel ? { start: Math.min(sel.a, sel.b), end: Math.max(sel.a, sel.b) + 1 } : loop.enabled ? { start: loop.startBar, end: loop.endBar } : null;
  return (
    <div
      className="relative shrink-0 cursor-col-resize touch-none select-none border-b border-panel-sunken"
      style={{ width: bars * BAR_W, height: RULER_H }}
      title="Drag to set the loop region"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        from.current = barAt(e);
        setSel({ a: from.current, b: from.current });
      }}
      onPointerMove={(e) => from.current !== null && setSel({ a: from.current, b: barAt(e) })}
      onPointerUp={() => {
        if (sel) actions.setLoop({ enabled: true, startBar: Math.min(sel.a, sel.b), endBar: Math.max(sel.a, sel.b) + 1 });
        from.current = null;
        setSel(null);
      }}
    >
      {shown && (
        <div aria-label={`Loop bars ${shown.start + 1}–${shown.end}`} className="absolute bottom-0 top-0 rounded-[4px]" style={{ left: shown.start * BAR_W, width: (shown.end - shown.start) * BAR_W, background: 'color-mix(in srgb, var(--led-on) 28%, transparent)', boxShadow: 'inset 0 0 0 1px var(--led-on)' }} />
      )}
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="label absolute top-[7px]" style={{ left: i * BAR_W + 4, color: i % 4 === 0 ? 'var(--ink)' : undefined }}>{i + 1}</span>
      ))}
    </div>
  );
}

function SongPlayhead({ height }: { height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const { playing, tick } = getPlayhead();
      const song = useWorkspace.getState().workspace.playMode === 'SONG';
      el.style.display = playing && song && tick >= 0 ? 'block' : 'none';
      el.style.transform = `translateX(${(tick / 16) * BAR_W}px)`;
    };
    apply();
    return subscribePlayhead(apply);
  }, []);
  return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute top-0 z-20 w-[2px] bg-led-on" style={{ left: HEADER_W, height, display: 'none', boxShadow: '0 0 6px var(--led-on)' }} />;
}

export function Song() {
  const w = useWorkspace((s) => s.workspace);
  const selectedClipId = useUi((s) => s.selectedClipId);
  const drag = useRef<Drag | null>(null);
  const bars = Math.min(SONG_BARS_MAX, w.songBars + EXTRA_BARS);
  const width = bars * BAR_W;

  const onDropAt = useCallback((lane: Lane, bar: number, e: DragEvent<HTMLDivElement>) => {
    const ws = useWorkspace.getState().workspace;
    if (lane.type === 'BEAT') {
      const beat = ws.beats.find((b) => b.id === e.dataTransfer.getData(BEAT_DRAG_TYPE));
      if (beat) actions.addClip({ kind: 'beat', laneId: lane.id, beatId: beat.id, startBar: bar, lengthBars: beatBars(beat) });
      return;
    }
    try {
      const s = JSON.parse(e.dataTransfer.getData(SOUND_DRAG_TYPE)) as SoundDragPayload;
      const lengthBars = Math.max(1, Math.round(s.durationMs / 1000 / barSeconds(ws.bpm)));
      actions.addClip({ kind: 'audio', laneId: lane.id, soundId: s.id, soundName: s.name, durationMs: s.durationMs, startBar: bar, lengthBars, gainDb: 0 });
      loadBuffer(s.id, 'LOOP').catch(() => {});
    } catch {
      /* not a sound payload */
    }
  }, []);

  const onClipPointerDown = useCallback((clip: Clip, e: ReactPointerEvent<HTMLDivElement>, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.preventDefault();
    let id = clip.id;
    if (mode === 'move' && e.altKey) {
      // Alt-drag duplicates (J7): the copy is what moves.
      actions.duplicateClip(clip.id);
      const clips = useWorkspace.getState().workspace.clips;
      id = clips[clips.length - 1].id;
    }
    useUi.getState().set({ selectedClipId: id });
    const cur = useWorkspace.getState().workspace.clips.find((c) => c.id === id)!;
    const lane = useWorkspace.getState().workspace.lanes.find((l) => l.id === cur.laneId)!;
    drag.current = { clipId: id, mode, x: e.clientX, startBar: cur.startBar, lengthBars: cur.lengthBars, laneType: lane.type, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).focus();
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dBars = Math.round((e.clientX - d.x) / BAR_W);
      if (d.mode === 'resize') {
        actions.updateClip('gesture', d.clipId, { lengthBars: Math.max(1, d.lengthBars + dBars) });
        return;
      }
      const laneEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-lane]');
      const laneId = laneEl && laneEl.dataset.laneType === d.laneType ? laneEl.dataset.lane : undefined;
      actions.updateClip('gesture', d.clipId, { startBar: Math.max(0, d.startBar + dBars), ...(laneId ? { laneId } : {}) });
    };
    const up = (e: PointerEvent) => {
      if (!drag.current || e.pointerId !== drag.current.pointerId) return;
      drag.current = null;
      actions.endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const beatLanes = w.lanes.filter((l) => l.type === 'BEAT').length;
  const audioLanes = w.lanes.length - beatLanes;
  const lanesHeight = RULER_H + w.lanes.length * 52;
  const songH = useLayout((s) => s.songH);
  const setSize = useLayout((s) => s.setSize);

  return (
    <section aria-label="Song" className="panel flex min-w-0 flex-col p-s4">
      <div className="mb-s3 flex flex-wrap items-center gap-s3">
        <h2 className="label text-ink">Song</h2>
        <span className="label">{w.songBars} bars · {w.playMode === 'SONG' ? 'playing the timeline' : 'press S or switch to SONG to play'}</span>
        <div className="ml-auto flex items-center gap-s2">
          <span className="label">Bars</span>
          <Lcd label="Song length in bars" width={56} value={w.songBars} min={4} max={SONG_BARS_MAX} step={1} format={(v) => String(v).padStart(3, '0')} onChange={(v) => actions.setSongBars(v)} />
          {w.loop.enabled && <button className="btn h-8 px-s3" onClick={() => actions.setLoop({ enabled: false })}>Clear loop</button>}
        </div>
      </div>

      <div className="no-scrollbar relative min-w-0 overflow-auto rounded-md bg-panel-sunken shadow-sunken" style={{ height: songH ?? undefined }} onPointerDown={(e) => e.target === e.currentTarget && useUi.getState().set({ selectedClipId: null })}>
        <div className="relative" style={{ width: HEADER_W + width }}>
          <div className="sticky top-0 z-20 flex bg-panel-sunken">
            <div className="sticky left-0 z-10 shrink-0 border-b border-r border-panel-sunken bg-panel" style={{ width: HEADER_W, height: RULER_H }} />
            <Ruler bars={bars} loop={w.loop} />
          </div>
          {w.lanes.map((lane) => (
            <LaneRow key={lane.id} lane={lane} width={width} onDropAt={onDropAt} canDelete={lane.type === 'BEAT' ? beatLanes > 1 : audioLanes > 1 || w.lanes.length > 1}>
              {w.clips
                .filter((c) => c.laneId === lane.id)
                .map((c) => (
                  <ClipView
                    key={c.id}
                    clip={c}
                    beat={c.kind === 'beat' ? w.beats.find((b) => b.id === c.beatId) : undefined}
                    rack={w.rack}
                    bpm={w.bpm}
                    selected={c.id === selectedClipId}
                    onPointerDown={(e, mode) => onClipPointerDown(c, e, mode)}
                  />
                ))}
            </LaneRow>
          ))}
          <SongPlayhead height={lanesHeight} />
          {w.clips.length === 0 && (
            <p className="pointer-events-none absolute text-ink-soft" style={{ left: HEADER_W + 16, top: RULER_H + 16 }}>Drag a beat here to start your tune.</p>
          )}
        </div>
      </div>

      <Splitter label="Song height" axis="y" className="-mb-s2 h-[12px] w-full" value={songH ?? lanesHeight} min={LAYOUT_LIMITS.songH.min} max={LAYOUT_LIMITS.songH.max}
        onChange={(v) => setSize({ songH: v })} onReset={() => setSize({ songH: null })} />

      <div className="mt-s1 flex flex-wrap gap-s2">
        <button className="btn" onClick={() => actions.addLane('BEAT')}><PlusIcon /> Beat lane</button>
        <button className="btn" onClick={() => actions.addLane('AUDIO')}><PlusIcon /> Audio lane</button>
        <span className="label ml-auto self-center">Drag clip edges to repeat · Alt-drag duplicates · Delete removes</span>
      </div>
    </section>
  );
}
