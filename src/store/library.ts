import { create } from 'zustand';
import { embed, soundEmbeddingText } from '../ai/embed';
import * as P from '../api/playlists';
import type { Playlist } from '../api/playlists';
import { copySound, deleteSound, listSounds, renameSound, type SoundMeta } from '../api/sounds';
import { useUi } from './ui';
import { useWorkspace } from './workspace';

// The Sound library shared by the Sound Browser tabs: Sounds, playlists (folders) and their membership.
// Pure helpers are exported for tests; actions call the API, then update local state (no full reload).

export interface LibraryState {
  sounds: SoundMeta[] | null;
  playlists: Playlist[];
  error: boolean;
  /** Playlist currently open in the Library tab (null = root: folders + unsorted Sounds). */
  openPlaylistId: string | null;
}

export const useLibrary = create<LibraryState>()(() => ({ sounds: null, playlists: [], error: false, openPlaylistId: null }));
const set = useLibrary.setState;
const get = useLibrary.getState;

// ── Pure helpers ──

/** Sound ids that are in at least one playlist. */
export function sortedIds(playlists: Playlist[]): Set<string> {
  return new Set(playlists.flatMap((p) => p.sound_ids));
}

/** Sounds in no playlist, newest first (input order kept). */
export function unsortedSounds(sounds: SoundMeta[], playlists: Playlist[]): SoundMeta[] {
  const inAny = sortedIds(playlists);
  return sounds.filter((s) => !inAny.has(s.id));
}

/** Sounds of one playlist, in the order they were added; ids of deleted Sounds are skipped. */
export function playlistSounds(sounds: SoundMeta[], playlist: Playlist): SoundMeta[] {
  const byId = new Map(sounds.map((s) => [s.id, s]));
  return playlist.sound_ids.map((id) => byId.get(id)).filter((s): s is SoundMeta => !!s);
}

export function playlistsOf(playlists: Playlist[], soundId: string): Playlist[] {
  return playlists.filter((p) => p.sound_ids.includes(soundId));
}

export function withMember(playlists: Playlist[], playlistId: string, soundId: string, member: boolean): Playlist[] {
  return playlists.map((p) => {
    if (p.id !== playlistId) return p;
    const has = p.sound_ids.includes(soundId);
    if (member === has) return p;
    return { ...p, sound_ids: member ? [...p.sound_ids, soundId] : p.sound_ids.filter((x) => x !== soundId) };
  });
}

export function sortPlaylists(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// ── Actions ──

const toast = (t: string, tone: 'info' | 'error' = 'info') => useUi.getState().toast(t, tone);

async function guard<T>(fn: () => Promise<T>, failText: string): Promise<T | null> {
  try {
    return await fn();
  } catch {
    toast(failText, 'error');
    return null;
  }
}

export async function refreshLibrary() {
  try {
    const [sounds, playlists] = await Promise.all([listSounds(undefined, 200), P.listPlaylists().catch(() => get().playlists)]);
    set({ sounds, playlists: sortPlaylists(playlists), error: false });
  } catch {
    set({ error: true });
  }
}

export function addToLibrary(s: SoundMeta) {
  set({ sounds: [s, ...(get().sounds ?? []).filter((x) => x.id !== s.id)] });
}

export function openPlaylist(id: string | null) {
  set({ openPlaylistId: id });
}

/** Rename a Sound: new name, rebuilt keyword index and (when the model is available) a new embedding. */
export async function renameLibrarySound(s: SoundMeta, name: string) {
  const n = name.trim();
  if (!n || n === s.name) return;
  const embedding = await embed(soundEmbeddingText(n, s.prompt, s.tags)).catch(() => undefined);
  const updated = await guard(() => renameSound(s.id, n, embedding), 'Could not rename that sound.');
  if (!updated) return;
  set({ sounds: (get().sounds ?? []).map((x) => (x.id === s.id ? updated : x)) });
  // Keep names in the open Workspace in step (Slots and audio clips store a copy of the name).
  useWorkspace.getState().edit((w) => {
    let changed = false;
    const rack = w.rack.map((slot) => (slot.sound.kind === 'sample' && slot.sound.soundId === s.id ? ((changed = true), { ...slot, sound: { ...slot.sound, name: n } }) : slot));
    const clips = w.clips.map((c) => (c.kind === 'audio' && c.soundId === s.id ? ((changed = true), { ...c, soundName: n }) : c));
    return changed ? { ...w, rack, clips } : w;
  }, 'silent');
  toast(`Renamed to “${n}”`);
}

export async function deleteLibrarySound(s: SoundMeta) {
  const ok = await guard(() => deleteSound(s.id), 'Could not delete that sound.');
  if (ok === null) return;
  set({
    sounds: (get().sounds ?? []).filter((x) => x.id !== s.id),
    playlists: get().playlists.map((p) => ({ ...p, sound_ids: p.sound_ids.filter((x) => x !== s.id) })),
  });
  toast(`Deleted “${s.name}”`);
}

/** Make a copy; when a playlist is open the copy joins it too. */
export async function copyLibrarySound(s: SoundMeta) {
  const copy = await guard(() => copySound(s.id), 'Could not copy that sound.');
  if (!copy) return;
  const inside = get().openPlaylistId;
  set({ sounds: [copy, ...(get().sounds ?? [])] });
  if (inside) await addSoundToPlaylist(copy, inside, { quiet: true });
  toast(`Copied as “${copy.name}”`);
}

export async function createLibraryPlaylist(name: string): Promise<Playlist | null> {
  const p = await guard(() => P.createPlaylist(name), 'Could not create the playlist.');
  if (p) set({ playlists: sortPlaylists([...get().playlists, p]) });
  return p;
}

export async function renameLibraryPlaylist(p: Playlist, name: string) {
  const updated = await guard(() => P.renamePlaylist(p.id, name), 'Could not rename the playlist.');
  if (updated) set({ playlists: sortPlaylists(get().playlists.map((x) => (x.id === p.id ? updated : x))) });
}

export async function deleteLibraryPlaylist(p: Playlist) {
  const ok = await guard(() => P.deletePlaylist(p.id), 'Could not delete the playlist.');
  if (ok === null) return;
  set({ playlists: get().playlists.filter((x) => x.id !== p.id), openPlaylistId: get().openPlaylistId === p.id ? null : get().openPlaylistId });
  toast(`Deleted playlist “${p.name}” — its sounds are still in the Library`);
}

export async function addSoundToPlaylist(s: SoundMeta, playlistId: string, opts: { quiet?: boolean } = {}) {
  const ok = await guard(() => P.addToPlaylist(playlistId, s.id), 'Could not add to the playlist.');
  if (ok === null) return;
  set({ playlists: withMember(get().playlists, playlistId, s.id, true) });
  if (!opts.quiet) toast(`Added to “${get().playlists.find((p) => p.id === playlistId)?.name ?? 'playlist'}”`);
}

export async function removeSoundFromPlaylist(s: SoundMeta, playlistId: string) {
  const ok = await guard(() => P.removeFromPlaylist(playlistId, s.id), 'Could not remove from the playlist.');
  if (ok === null) return;
  set({ playlists: withMember(get().playlists, playlistId, s.id, false) });
}

/** Move: leave `from` (the open playlist, or null at the root) and join `to`. */
export async function moveSoundToPlaylist(s: SoundMeta, from: string | null, to: string) {
  if (from === to) return;
  const ok = await guard(() => P.moveToPlaylist(s.id, from, to), 'Could not move the sound.');
  if (ok === null) return;
  let next = withMember(get().playlists, to, s.id, true);
  if (from) next = withMember(next, from, s.id, false);
  set({ playlists: next });
  toast(`Moved to “${next.find((p) => p.id === to)?.name ?? 'playlist'}”`);
}

/** Creates a playlist, then adds or moves the Sound into it. */
export async function newPlaylistWith(s: SoundMeta, name: string, mode: 'add' | 'move') {
  const p = await createLibraryPlaylist(name);
  if (!p) return;
  if (mode === 'add') await addSoundToPlaylist(s, p.id);
  else await moveSoundToPlaylist(s, get().openPlaylistId, p.id);
}
