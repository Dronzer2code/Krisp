import {
  defaultChannel, emptyBeat, emptyRow, emptyStep, nextColor, nextPitch, newWorkspace, VELOCITY_CYCLE,
} from '../model/defaults';
import { newId } from '../model/ids';
import {
  BPM_MAX, BPM_MIN, SONG_BARS_MAX, SONG_BARS_MIN, SWING_MAX, TUNE_RANGE,
  type AudioClip, type Beat, type BeatClip, type Channel, type Clip, type Id, type Lane, type Master, type PlayMode,
  type Slot, type SlotSound, type Step, type Workspace,
} from '../model/types';
import { getPresetBeat, presetToBeat } from '../presets/beats';

// Pure, immutable edit operations on a Workspace. Every function returns the same object when nothing changes.
// The zustand store (store/workspace.ts) wraps these with undo history.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── Workspace creation ──

export function createWorkspace(name: string, presetId?: string): Workspace {
  const ws = newWorkspace(name);
  const preset = presetId ? getPresetBeat(presetId) : undefined;
  if (!preset) return ws;
  const beat = presetToBeat(preset, ws.rack, ws.beats[0].color);
  const lane = ws.lanes.find((l) => l.type === 'BEAT')!;
  const clip: BeatClip = { id: newId(), kind: 'beat', laneId: lane.id, beatId: beat.id, startBar: 0, lengthBars: 4 };
  return { ...ws, bpm: preset.bpm, swing: preset.swing, beats: [beat], selectedBeatId: beat.id, clips: [clip] };
}

// ── Transport / Workspace settings ──

export function setName(w: Workspace, name: string): Workspace {
  const n = name.trim() || 'Untitled beat';
  return n === w.name ? w : { ...w, name: n };
}

export function setBpm(w: Workspace, bpm: number): Workspace {
  const v = Math.round(clamp(bpm, BPM_MIN, BPM_MAX) * 10) / 10;
  return v === w.bpm ? w : { ...w, bpm: v };
}

export function setSwing(w: Workspace, swing: number): Workspace {
  const v = Math.round(clamp(swing, 0, SWING_MAX) * 1000) / 1000;
  return v === w.swing ? w : { ...w, swing: v };
}

export function setPlayMode(w: Workspace, playMode: PlayMode): Workspace {
  return playMode === w.playMode ? w : { ...w, playMode };
}

export function setMetronome(w: Workspace, metronome: boolean): Workspace {
  return metronome === w.metronome ? w : { ...w, metronome };
}

export function setLoop(w: Workspace, patch: Partial<Workspace['loop']>): Workspace {
  const loop = { ...w.loop, ...patch };
  loop.startBar = Math.max(0, Math.round(loop.startBar));
  loop.endBar = Math.max(loop.startBar + 1, Math.round(loop.endBar));
  if (loop.enabled === w.loop.enabled && loop.startBar === w.loop.startBar && loop.endBar === w.loop.endBar) return w;
  return { ...w, loop };
}

// ── Rack ──

export function addSlot(w: Workspace, sound: SlotSound, name?: string): Workspace {
  const slot: Slot = {
    id: newId(),
    name: name ?? (sound.kind === 'sample' ? sound.name : `Slot ${w.rack.length + 1}`),
    color: nextColor(w.rack.map((s) => s.color)),
    sound,
    pitch: nextPitch(w.rack),
    tune: 0,
  };
  return {
    ...w,
    rack: [...w.rack, slot],
    beats: w.beats.map((b) => ({ ...b, steps: { ...b.steps, [slot.id]: emptyRow(b.length) } })),
    mixer: { ...w.mixer, channels: { ...w.mixer.channels, [slot.id]: defaultChannel() } },
  };
}

export function removeSlot(w: Workspace, slotId: Id): Workspace {
  if (!w.rack.some((s) => s.id === slotId)) return w;
  const channels = { ...w.mixer.channels };
  delete channels[slotId];
  return {
    ...w,
    rack: w.rack.filter((s) => s.id !== slotId),
    beats: w.beats.map((b) => {
      if (!(slotId in b.steps)) return b;
      const steps = { ...b.steps };
      delete steps[slotId];
      return { ...b, steps };
    }),
    mixer: { ...w.mixer, channels },
  };
}

export function updateSlot(w: Workspace, slotId: Id, patch: Partial<Pick<Slot, 'name' | 'color' | 'tune' | 'sound'>>): Workspace {
  let changed = false;
  const rack = w.rack.map((s) => {
    if (s.id !== slotId) return s;
    const next = { ...s, ...patch };
    if (patch.tune !== undefined) next.tune = Math.round(clamp(patch.tune, -TUNE_RANGE, TUNE_RANGE));
    if (patch.name !== undefined) next.name = patch.name.trim() || s.name;
    changed = next.name !== s.name || next.color !== s.color || next.tune !== s.tune || next.sound !== s.sound;
    return changed ? next : s;
  });
  return changed ? { ...w, rack } : w;
}

// ── Beats ──

export function rowOf(beat: Beat, slotId: Id): Step[] {
  return beat.steps[slotId] ?? emptyRow(beat.length);
}

function mapBeat(w: Workspace, beatId: Id, fn: (b: Beat) => Beat): Workspace {
  let changed = false;
  const beats = w.beats.map((b) => {
    if (b.id !== beatId) return b;
    const next = fn(b);
    if (next !== b) changed = true;
    return next;
  });
  return changed ? { ...w, beats } : w;
}

export function selectBeat(w: Workspace, beatId: Id): Workspace {
  if (w.selectedBeatId === beatId || !w.beats.some((b) => b.id === beatId)) return w;
  return { ...w, selectedBeatId: beatId };
}

function nextBeatName(w: Workspace, base = 'Beat'): string {
  const names = new Set(w.beats.map((b) => b.name));
  let i = w.beats.length + 1;
  while (names.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function uniqueName(w: Workspace, name: string): string {
  const names = new Set(w.beats.map((b) => b.name));
  if (!names.has(name)) return name;
  let i = 2;
  while (names.has(`${name} ${i}`)) i++;
  return `${name} ${i}`;
}

function appendBeat(w: Workspace, beat: Beat): Workspace {
  return { ...w, beats: [...w.beats, beat], selectedBeatId: beat.id };
}

export function addBeat(w: Workspace): Workspace {
  return appendBeat(w, emptyBeat(w.rack, nextBeatName(w), nextColor(w.beats.map((b) => b.color))));
}

export function duplicateBeat(w: Workspace, beatId: Id): Workspace {
  const src = w.beats.find((b) => b.id === beatId);
  if (!src) return w;
  const copy: Beat = { ...src, id: newId(), name: uniqueName(w, `${src.name} copy`), color: nextColor(w.beats.map((b) => b.color)) };
  const idx = w.beats.indexOf(src);
  const beats = [...w.beats.slice(0, idx + 1), copy, ...w.beats.slice(idx + 1)];
  return { ...w, beats, selectedBeatId: copy.id };
}

export function renameBeat(w: Workspace, beatId: Id, name: string): Workspace {
  const n = name.trim();
  if (!n) return w;
  return mapBeat(w, beatId, (b) => (b.name === n ? b : { ...b, name: n }));
}

export function recolorBeat(w: Workspace, beatId: Id, color: string): Workspace {
  return mapBeat(w, beatId, (b) => (b.color === color ? b : { ...b, color }));
}

/** Removes the Beat and its clips. The last remaining Beat cannot be deleted. */
export function deleteBeat(w: Workspace, beatId: Id): Workspace {
  const idx = w.beats.findIndex((b) => b.id === beatId);
  if (idx < 0 || w.beats.length <= 1) return w;
  const beats = w.beats.filter((b) => b.id !== beatId);
  const selectedBeatId = w.selectedBeatId === beatId ? beats[Math.min(idx, beats.length - 1)].id : w.selectedBeatId;
  return { ...w, beats, selectedBeatId, clips: w.clips.filter((c) => !(c.kind === 'beat' && c.beatId === beatId)) };
}

function isPristine(w: Workspace): boolean {
  return w.clips.length === 0 && w.beats.every((b) => Object.values(b.steps).every((row) => row.every((s) => !s.on)));
}

/** AC-F4.4: adds a new Beat chip; existing Beats unchanged. BPM/swing applied only when the Workspace is empty (J3). */
export function insertPresetBeat(w: Workspace, presetId: string): Workspace {
  const preset = getPresetBeat(presetId);
  if (!preset) return w;
  const beat = presetToBeat(preset, w.rack, nextColor(w.beats.map((b) => b.color)));
  beat.name = uniqueName(w, preset.name);
  const next = appendBeat(w, beat);
  return isPristine(w) ? { ...next, bpm: preset.bpm, swing: preset.swing } : next;
}

/** AC-F4.3: 16 → 32 copies bar 1 into bar 2; 32 → 16 keeps bar 1. */
export function setBeatLength(w: Workspace, beatId: Id, length: 16 | 32): Workspace {
  return mapBeat(w, beatId, (b) => {
    if (b.length === length) return b;
    const steps: Beat['steps'] = {};
    for (const slot of w.rack) {
      const row = rowOf(b, slot.id);
      steps[slot.id] = length === 32 ? [...row.slice(0, 16), ...row.slice(0, 16).map((s) => ({ ...s }))] : row.slice(0, 16);
    }
    return { ...b, length, steps };
  });
}

export function setStep(w: Workspace, beatId: Id, slotId: Id, index: number, patch: Partial<Step>): Workspace {
  return mapBeat(w, beatId, (b) => {
    if (index < 0 || index >= b.length) return b;
    const row = rowOf(b, slotId);
    const cur = row[index] ?? emptyStep();
    const next = { ...cur, ...patch };
    if (next.on === cur.on && next.velocity === cur.velocity && next.offset === cur.offset) return b;
    const newRow = row.slice();
    newRow[index] = next;
    return { ...b, steps: { ...b.steps, [slotId]: newRow } };
  });
}

export function toggleStep(w: Workspace, beatId: Id, slotId: Id, index: number): Workspace {
  const beat = w.beats.find((b) => b.id === beatId);
  if (!beat) return w;
  const cur = rowOf(beat, slotId)[index];
  // Turning a step on resets it to normal velocity, no offset.
  return setStep(w, beatId, slotId, index, cur?.on ? { on: false } : { on: true, velocity: 100, offset: 0 });
}

export function nextVelocity(v: number): number {
  const i = VELOCITY_CYCLE.indexOf(v as (typeof VELOCITY_CYCLE)[number]);
  if (i >= 0) return VELOCITY_CYCLE[(i + 1) % VELOCITY_CYCLE.length];
  // Humanized velocities: jump to the next level above, wrapping to the first.
  const sorted = [...VELOCITY_CYCLE].sort((a, b) => a - b);
  return sorted.find((x) => x > v) ?? VELOCITY_CYCLE[0];
}

/** AC-F4.2: cycles an active step's velocity 100 → 127 → 40 → 80. Inactive steps turn on at 100. */
export function cycleVelocity(w: Workspace, beatId: Id, slotId: Id, index: number): Workspace {
  const beat = w.beats.find((b) => b.id === beatId);
  if (!beat) return w;
  const cur = rowOf(beat, slotId)[index];
  if (!cur?.on) return setStep(w, beatId, slotId, index, { on: true, velocity: 100, offset: 0 });
  return setStep(w, beatId, slotId, index, { velocity: nextVelocity(cur.velocity) });
}

export function clearRow(w: Workspace, beatId: Id, slotId: Id): Workspace {
  return mapBeat(w, beatId, (b) => {
    const row = rowOf(b, slotId);
    if (row.every((s) => !s.on)) return b;
    return { ...b, steps: { ...b.steps, [slotId]: emptyRow(b.length) } };
  });
}

export function clearBeat(w: Workspace, beatId: Id): Workspace {
  return mapBeat(w, beatId, (b) => {
    if (Object.values(b.steps).every((row) => row.every((s) => !s.on))) return b;
    const steps: Beat['steps'] = {};
    for (const slot of w.rack) steps[slot.id] = emptyRow(b.length);
    return { ...b, steps };
  });
}

/** AI apply: replaces the Beat's steps (and optionally its length). */
export function setBeatSteps(w: Workspace, beatId: Id, steps: Beat['steps'], length?: 16 | 32): Workspace {
  return mapBeat(w, beatId, (b) => ({ ...b, steps, length: length ?? b.length }));
}

/** AI "Add as new beat". */
export function addBeatFromSteps(w: Workspace, name: string, steps: Beat['steps'], length: 16 | 32): Workspace {
  const beat: Beat = { id: newId(), name: uniqueName(w, name), color: nextColor(w.beats.map((b) => b.color)), length, steps };
  return appendBeat(w, beat);
}

// ── Song ──

export function beatBars(beat: Beat): number {
  return beat.length / 16;
}

function withSongBars(w: Workspace): Workspace {
  const maxEnd = w.clips.reduce((m, c) => Math.max(m, c.startBar + c.lengthBars), 0);
  const songBars = clamp(Math.max(w.songBars, maxEnd), SONG_BARS_MIN, SONG_BARS_MAX);
  return songBars === w.songBars ? w : { ...w, songBars };
}

export function setSongBars(w: Workspace, bars: number): Workspace {
  const maxEnd = w.clips.reduce((m, c) => Math.max(m, c.startBar + c.lengthBars), 0);
  const v = clamp(Math.max(Math.round(bars), maxEnd), SONG_BARS_MIN, SONG_BARS_MAX);
  return v === w.songBars ? w : { ...w, songBars: v };
}

export function addLane(w: Workspace, type: Lane['type']): Workspace {
  const count = w.lanes.filter((l) => l.type === type).length + 1;
  const lane: Lane = { id: newId(), name: `${type === 'BEAT' ? 'Beats' : 'Audio'} ${count}`, type };
  const next = { ...w, lanes: [...w.lanes, lane] };
  if (type === 'AUDIO') next.mixer = { ...w.mixer, channels: { ...w.mixer.channels, [lane.id]: defaultChannel() } };
  return next;
}

export function renameLane(w: Workspace, laneId: Id, name: string): Workspace {
  const n = name.trim();
  if (!n) return w;
  let changed = false;
  const lanes = w.lanes.map((l) => (l.id === laneId && l.name !== n ? ((changed = true), { ...l, name: n }) : l));
  return changed ? { ...w, lanes } : w;
}

export function removeLane(w: Workspace, laneId: Id): Workspace {
  if (!w.lanes.some((l) => l.id === laneId)) return w;
  const channels = { ...w.mixer.channels };
  delete channels[laneId];
  return {
    ...w,
    lanes: w.lanes.filter((l) => l.id !== laneId),
    clips: w.clips.filter((c) => c.laneId !== laneId),
    mixer: { ...w.mixer, channels },
  };
}

export type NewClip = Omit<BeatClip, 'id'> | Omit<AudioClip, 'id'>;

function laneAccepts(w: Workspace, laneId: Id, kind: Clip['kind']): boolean {
  const lane = w.lanes.find((l) => l.id === laneId);
  return !!lane && (lane.type === 'BEAT') === (kind === 'beat');
}

export function addClip(w: Workspace, clip: NewClip): Workspace {
  if (!laneAccepts(w, clip.laneId, clip.kind)) return w;
  const c = { ...clip, id: newId(), startBar: Math.max(0, Math.round(clip.startBar)), lengthBars: Math.max(1, Math.round(clip.lengthBars)) } as Clip;
  if (c.startBar + c.lengthBars > SONG_BARS_MAX) return w;
  return withSongBars({ ...w, clips: [...w.clips, c] });
}

export function updateClip(w: Workspace, clipId: Id, patch: Partial<Pick<Clip, 'startBar' | 'lengthBars' | 'laneId'>>): Workspace {
  const cur = w.clips.find((c) => c.id === clipId);
  if (!cur) return w;
  const next = { ...cur, ...patch } as Clip;
  next.startBar = Math.max(0, Math.round(next.startBar));
  next.lengthBars = Math.max(1, Math.round(next.lengthBars));
  if (next.startBar + next.lengthBars > SONG_BARS_MAX) return w;
  if (!laneAccepts(w, next.laneId, next.kind)) return w;
  if (next.startBar === cur.startBar && next.lengthBars === cur.lengthBars && next.laneId === cur.laneId) return w;
  return withSongBars({ ...w, clips: w.clips.map((c) => (c.id === clipId ? next : c)) });
}

export function removeClip(w: Workspace, clipId: Id): Workspace {
  return w.clips.some((c) => c.id === clipId) ? { ...w, clips: w.clips.filter((c) => c.id !== clipId) } : w;
}

/** Places a copy directly after the original on the same Lane. */
export function duplicateClip(w: Workspace, clipId: Id): Workspace {
  const cur = w.clips.find((c) => c.id === clipId);
  if (!cur) return w;
  const { id: _id, ...rest } = cur;
  void _id;
  return addClip(w, { ...rest, startBar: cur.startBar + cur.lengthBars } as NewClip);
}

// ── Mixer ──

export function setChannel(w: Workspace, id: Id, patch: Partial<Channel>): Workspace {
  const cur = w.mixer.channels[id] ?? defaultChannel();
  const next: Channel = { ...cur, ...patch, eq: patch.eq ? { ...cur.eq, ...patch.eq } : cur.eq };
  next.pan = clamp(next.pan, -1, 1);
  next.reverbSend = clamp(next.reverbSend, 0, 1);
  next.volumeDb = clamp(next.volumeDb, -60, 6);
  if (JSON.stringify(next) === JSON.stringify(cur) && w.mixer.channels[id]) return w;
  return { ...w, mixer: { ...w.mixer, channels: { ...w.mixer.channels, [id]: next } } };
}

export type MasterPatch = {
  volumeDb?: number;
  eq?: Partial<Master['eq']>;
  compressor?: Partial<Master['compressor']>;
  limiter?: Partial<Master['limiter']>;
  reverb?: Partial<Master['reverb']>;
};

export function setMaster(w: Workspace, patch: MasterPatch): Workspace {
  const m = w.mixer.master;
  const next: Master = {
    volumeDb: patch.volumeDb ?? m.volumeDb,
    eq: { ...m.eq, ...patch.eq },
    compressor: { ...m.compressor, ...patch.compressor },
    limiter: { ...m.limiter, ...patch.limiter },
    reverb: { ...m.reverb, ...patch.reverb },
  };
  if (JSON.stringify(next) === JSON.stringify(m)) return w;
  return { ...w, mixer: { ...w.mixer, master: next } };
}
