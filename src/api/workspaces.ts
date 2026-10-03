import type { Workspace } from '../model/types';
import { apiFetch, apiJson } from './client';

export interface WorkspaceSummary {
  id: string;
  name: string;
  updated_at: string;
  colors: string[];
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return (await apiJson<{ workspaces: WorkspaceSummary[] }>('/api/workspaces')).workspaces;
}

export async function getWorkspace(id: string): Promise<Workspace> {
  return (await apiJson<{ workspace: Workspace }>(`/api/workspaces?id=${encodeURIComponent(id)}`)).workspace;
}

export async function saveWorkspace(w: Workspace): Promise<{ id: string; updated_at: string }> {
  return apiJson('/api/workspaces', { method: 'POST', body: JSON.stringify({ workspace: w }) });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await apiFetch(`/api/workspaces?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** SHOULD F1: duplicate = load, clear id, save as "<name> copy". */
export async function duplicateWorkspace(id: string): Promise<string> {
  const w = await getWorkspace(id);
  const saved = await saveWorkspace({ ...w, id: null, name: `${w.name} copy`.slice(0, 100) });
  return saved.id;
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const w = await getWorkspace(id);
  await saveWorkspace({ ...w, name });
}
