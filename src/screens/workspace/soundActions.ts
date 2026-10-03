import { ensureAudioStarted } from '../../audio/context';
import { loadBuffer } from '../../audio/buffers';
import type { SoundKind } from '../../audio/analyze';
import { getPlayhead } from '../../audio/playhead';
import { barSeconds } from '../../audio/scheduler';
import type { Id, SynthPreset } from '../../model/types';
import { useUi } from '../../store/ui';
import { actions, useWorkspace } from '../../store/workspace';

// Shared "Use" behaviour for the Sound Browser (docs/PROCESS_FLOW.md J4 step 4).

export interface UsableSound {
  id: Id;
  name: string;
  kind: SoundKind;
  durationMs: number;
}

let stopPreview: (() => void) | null = null;
let previewId: string | null = null;

/** Plays a library Sound (toggle: a second click on the same Sound stops it). */
export async function previewSound(s: UsableSound) {
  const engine = await ensureAudioStarted();
  stopPreview?.();
  stopPreview = null;
  if (previewId === s.id) {
    previewId = null;
    return;
  }
  previewId = s.id;
  try {
    const buf = await loadBuffer(s.id, s.kind);
    if (previewId !== s.id) return;
    stopPreview = engine.previewBuffer(buf);
    window.setTimeout(() => {
      if (previewId === s.id) previewId = null;
    }, Math.min(8000, buf.duration * 1000));
  } catch {
    previewId = null;
    useUi.getState().toast('Could not load that sound.', 'error');
  }
}

export async function previewPreset(preset: SynthPreset) {
  (await ensureAudioStarted()).previewPreset(preset);
}

/** Assigns a one-shot to a Slot (replace sound). */
export function assignToSlot(slotId: Id, s: Pick<UsableSound, 'id' | 'name'>) {
  actions.updateSlot('push', slotId, { sound: { kind: 'sample', soundId: s.id, name: s.name } });
  loadBuffer(s.id, 'ONE_SHOT').catch(() => useUi.getState().toast('Sound failed to load — the Slot stays silent until it does.', 'error'));
  const slot = useWorkspace.getState().workspace.rack.find((x) => x.id === slotId);
  useUi.getState().announce(`${s.name} assigned to ${slot?.name ?? 'Slot'}`);
}

export function assignPresetToSlot(slotId: Id, preset: SynthPreset) {
  actions.updateSlot('push', slotId, { sound: { kind: 'synth', preset } });
}

export function addAsNewSlot(s: Pick<UsableSound, 'id' | 'name'>) {
  actions.addSlot({ kind: 'sample', soundId: s.id, name: s.name }, s.name);
  loadBuffer(s.id, 'ONE_SHOT').catch(() => {});
}

/** Places a loop on the first AUDIO lane (creating one if needed) at the playhead bar. */
export function placeOnAudioLane(s: UsableSound, laneId?: Id) {
  let w = useWorkspace.getState().workspace;
  let lane = laneId ? w.lanes.find((l) => l.id === laneId) : w.lanes.find((l) => l.type === 'AUDIO');
  if (!lane) {
    actions.addLane('AUDIO');
    w = useWorkspace.getState().workspace;
    lane = w.lanes[w.lanes.length - 1];
  }
  const tick = getPlayhead().tick;
  const startBar = tick >= 0 ? Math.floor(tick / 16) : 0;
  const lengthBars = Math.max(1, Math.round(s.durationMs / 1000 / barSeconds(w.bpm)));
  actions.addClip({ kind: 'audio', laneId: lane.id, soundId: s.id, soundName: s.name, durationMs: s.durationMs, startBar, lengthBars, gainDb: 0 });
  loadBuffer(s.id, 'LOOP').catch(() => {});
  useUi.getState().announce(`${s.name} placed on ${lane.name} at bar ${startBar + 1}`);
}
