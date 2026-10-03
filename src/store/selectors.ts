import { defaultChannel } from '../model/defaults';
import type { Beat, Channel, Id, Workspace } from '../model/types';

export function selectedBeat(w: Workspace): Beat | undefined {
  return w.beats.find((b) => b.id === w.selectedBeatId) ?? w.beats[0];
}

export function channelOf(w: Workspace, id: Id): Channel {
  return w.mixer.channels[id] ?? defaultChannel();
}

/** Channel ids that exist in the Mixer: one per Slot, one per AUDIO Lane. */
export function channelIds(w: Workspace): Id[] {
  return [...w.rack.map((s) => s.id), ...w.lanes.filter((l) => l.type === 'AUDIO').map((l) => l.id)];
}

/** DAW-style solo: muted, or another Channel is soloed and this one is not (docs/TRD.md → AUDIO ENGINE). */
export function isChannelSilenced(w: Workspace, id: Id): boolean {
  const ch = channelOf(w, id);
  if (ch.mute) return true;
  const anySolo = channelIds(w).some((cid) => channelOf(w, cid).solo);
  return anySolo && !ch.solo;
}

export function clipsUsingBeat(w: Workspace, beatId: Id): number {
  return w.clips.filter((c) => c.kind === 'beat' && c.beatId === beatId).length;
}
