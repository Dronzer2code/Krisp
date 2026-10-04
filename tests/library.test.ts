import { describe, expect, it } from 'vitest';
import { cleanPlaylistName } from '../api/playlists';
import type { Playlist } from '../src/api/playlists';
import type { SoundMeta } from '../src/api/sounds';
import { playlistSounds, playlistsOf, sortPlaylists, unsortedSounds, withMember } from '../src/store/library';

const sound = (id: string): SoundMeta => ({ id, name: id, kind: 'ONE_SHOT', source: 'UPLOAD', prompt: null, tags: [], duration_ms: 500, created_at: '' });
const pl = (id: string, name: string, ids: string[]): Playlist => ({ id, name, created_at: '', sound_ids: ids });
const sounds = ['a', 'b', 'c', 'd'].map(sound);
const lists = [pl('p1', 'Kicks', ['a', 'c']), pl('p2', 'Loops', ['c'])];

describe('library helpers', () => {
  it('unsorted = sounds in no playlist, order kept', () => {
    expect(unsortedSounds(sounds, lists).map((s) => s.id)).toEqual(['b', 'd']);
    expect(unsortedSounds(sounds, []).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('playlist sounds follow added order and skip deleted sounds', () => {
    expect(playlistSounds(sounds, pl('p', 'x', ['c', 'zz', 'a'])).map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('a sound can be in several playlists', () => {
    expect(playlistsOf(lists, 'c').map((p) => p.name)).toEqual(['Kicks', 'Loops']);
  });

  it('withMember adds once and removes', () => {
    const added = withMember(lists, 'p2', 'b', true);
    expect(added.find((p) => p.id === 'p2')!.sound_ids).toEqual(['c', 'b']);
    expect(withMember(added, 'p2', 'b', true).find((p) => p.id === 'p2')!.sound_ids).toEqual(['c', 'b']);
    expect(withMember(lists, 'p1', 'a', false).find((p) => p.id === 'p1')!.sound_ids).toEqual(['c']);
  });

  it('move = leave the source, join the target', () => {
    let next = withMember(lists, 'p2', 'a', true);
    next = withMember(next, 'p1', 'a', false);
    expect(unsortedSounds(sounds, next).map((s) => s.id)).toEqual(['b', 'd']);
    expect(next.find((p) => p.id === 'p1')!.sound_ids).toEqual(['c']);
    expect(next.find((p) => p.id === 'p2')!.sound_ids).toEqual(['c', 'a']);
  });

  it('playlists sort by name, case-insensitive', () => {
    expect(sortPlaylists([pl('1', 'loops', []), pl('2', 'Drums', []), pl('3', 'ambient', [])]).map((p) => p.name)).toEqual(['ambient', 'Drums', 'loops']);
  });
});

describe('cleanPlaylistName', () => {
  it('trims, collapses spaces, limits to 60', () => {
    expect(cleanPlaylistName('  Lo-fi   loops ')).toBe('Lo-fi loops');
    expect(cleanPlaylistName('x'.repeat(80))).toHaveLength(60);
  });
  it('rejects empty and non-strings', () => {
    expect(cleanPlaylistName('   ')).toBeNull();
    expect(cleanPlaylistName(5)).toBeNull();
  });
});
