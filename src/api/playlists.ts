import { apiJson } from './client';

export interface Playlist {
  id: string;
  name: string;
  created_at: string;
  sound_ids: string[];
}

export async function listPlaylists(): Promise<Playlist[]> {
  return (await apiJson<{ playlists: Playlist[] }>('/api/playlists')).playlists;
}

export async function createPlaylist(name: string): Promise<Playlist> {
  return (await apiJson<{ playlist: Playlist }>('/api/playlists', { method: 'POST', body: JSON.stringify({ name }) })).playlist;
}

export async function renamePlaylist(id: string, name: string): Promise<Playlist> {
  return (await apiJson<{ playlist: Playlist }>(`/api/playlists?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })).playlist;
}

export async function deletePlaylist(id: string): Promise<void> {
  await apiJson(`/api/playlists?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addToPlaylist(playlistId: string, soundId: string): Promise<void> {
  await apiJson('/api/playlists?op=add', { method: 'POST', body: JSON.stringify({ playlistId, soundId }) });
}

export async function removeFromPlaylist(playlistId: string, soundId: string): Promise<void> {
  await apiJson('/api/playlists?op=remove', { method: 'POST', body: JSON.stringify({ playlistId, soundId }) });
}

export async function moveToPlaylist(soundId: string, from: string | null, to: string): Promise<void> {
  await apiJson('/api/playlists?op=move', { method: 'POST', body: JSON.stringify({ soundId, from, to }) });
}
