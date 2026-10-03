import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { deleteWorkspace, duplicateWorkspace, listWorkspaces, renameWorkspace, type WorkspaceSummary } from '../api/workspaces';
import { PRESET_BEATS, type PresetBeat } from '../presets/beats';
import { navigate } from '../router';
import { createWorkspace } from '../store/ops';
import { useUi } from '../store/ui';
import { useWorkspace } from '../store/workspace';
import { Dialog } from '../ui/Dialog';
import { MoreIcon, PlusIcon } from '../ui/icons';
import { Menu } from '../ui/Menu';
import { Panel } from '../ui/Panel';

// docs/UI_DESIGN.md → Home; docs/PROCESS_FLOW.md J1. Workspace "cartridges", New workspace dialog.

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function MiniStrip({ preset }: { preset: PresetBeat }) {
  const rows = Object.values(preset.rows).slice(0, 3);
  return (
    <div aria-hidden="true" className="flex flex-col gap-[2px]">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-[2px]">
          {[...r].map((ch, j) => (
            <span key={j} className="h-[5px] w-[5px] rounded-[1px]" style={{ background: ch === '.' ? 'var(--panel-sunken)' : 'var(--led-on)', opacity: ch === '.' ? 1 : ch === 'g' ? 0.45 : ch === 's' ? 0.7 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function NewWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('Untitled beat');
  const [start, setStart] = useState<string>('empty');
  useEffect(() => {
    if (open) {
      setName('Untitled beat');
      setStart('empty');
    }
  }, [open]);

  const create = () => {
    const ws = createWorkspace(name.trim() || 'Untitled beat', start === 'empty' ? undefined : start);
    useWorkspace.getState().load(ws);
    onClose();
    navigate('/w/new');
  };

  const options = [{ id: 'empty', label: 'Empty', sub: '90 BPM' }, ...PRESET_BEATS.map((p) => ({ id: p.id, label: p.name, sub: `${p.bpm} BPM` }))];

  return (
    <Dialog
      open={open}
      title="New workspace"
      onClose={onClose}
      width={620}
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); create(); }}>
        <label className="label mb-s2 block" htmlFor="ws-name">Name</label>
        <input id="ws-name" data-autofocus className="field mb-s5" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <fieldset>
          <legend className="label mb-s2">Start from</legend>
          <div role="radiogroup" aria-label="Start from" className="grid grid-cols-2 gap-s3 mid:grid-cols-3">
            {options.map((o) => {
              const preset = PRESET_BEATS.find((p) => p.id === o.id);
              const checked = start === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`flex h-[84px] flex-col justify-between rounded-md p-s3 text-left ${checked ? 'shadow-pressed' : 'bg-panel-raised shadow-raised'}`}
                  style={checked ? { background: 'var(--panel-sunken)', outline: '2px solid var(--led-on)', outlineOffset: -2 } : undefined}
                  onClick={() => setStart(o.id)}
                  onDoubleClick={create}
                >
                  <span className="flex items-baseline justify-between gap-s2">
                    <span className="font-semibold">{o.label}</span>
                    <span className="label">{o.sub}</span>
                  </span>
                  {preset ? <MiniStrip preset={preset} /> : <span className="label">Blank 16-step beat</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

export default function Home() {
  const [items, setItems] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ ws: WorkspaceSummary; anchor: HTMLElement } | null>(null);
  const [renaming, setRenaming] = useState<WorkspaceSummary | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceSummary | null>(null);
  const toast = useUi((s) => s.toast);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await listWorkspaces());
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError && err.status === 401 ? 'Enter the studio passcode to see saved workspaces.' : 'Could not load workspaces. Check your connection.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      await load();
    } catch {
      toast('That did not work. Try again.', 'error');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-s5 p-s4 mid:p-s6">
      <Panel label="Pocket" screws className="flex items-end justify-between px-s6 py-s5">
        <div>
          <h1 className="font-display text-[30px] font-medium tracking-[.14em] text-ink">POCKET</h1>
          <p className="label mt-s1">beat workspace</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><PlusIcon /> New workspace</button>
      </Panel>

      {error && (
        <Panel label="Notice" className="flex items-center justify-between gap-s4 px-s5 py-s4">
          <p>{error}</p>
          <button className="btn" onClick={() => void load()}>Retry</button>
        </Panel>
      )}

      {items === null ? (
        <p className="label px-s2" role="status">Loading workspaces…</p>
      ) : items.length === 0 && !error ? (
        <Panel label="No workspaces" className="flex flex-col items-center gap-s4 px-s6 py-s6 text-center">
          <p className="title">No workspaces yet — start one and hear a beat in seconds.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><PlusIcon /> New workspace</button>
        </Panel>
      ) : (
        <ul className="grid gap-s5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }} aria-label="Workspaces">
          <li>
            <button
              className="flex h-[140px] w-full flex-col items-center justify-center gap-s2 rounded-lg border-2 border-dashed border-[#BDB7AC] bg-panel-sunken text-ink-soft shadow-sunken hover:text-ink"
              onClick={() => setCreating(true)}
            >
              <PlusIcon size={28} />
              <span className="font-semibold">New workspace</span>
            </button>
          </li>
          {items.map((ws) => (
            <li key={ws.id} className="panel relative flex h-[140px] flex-col rounded-lg p-s4">
              <button className="absolute inset-0 rounded-lg" aria-label={`Open ${ws.name}`} onClick={() => navigate(`/w/${ws.id}`)} />
              <div className="pointer-events-none relative flex items-start justify-between gap-s2">
                <span className="title line-clamp-2">{ws.name}</span>
              </div>
              <span className="label pointer-events-none relative mt-s1">Edited {ago(ws.updated_at)}</span>
              <div className="pointer-events-none relative mt-auto flex gap-[3px]" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="h-[6px] flex-1 rounded-full" style={{ background: ws.colors[i] ?? 'var(--panel-sunken)', boxShadow: ws.colors[i] ? `0 0 4px ${ws.colors[i]}` : 'var(--shadow-sunken)' }} />
                ))}
              </div>
              <button className="icon-btn absolute right-s2 top-s2" aria-label={`${ws.name} options`} aria-haspopup="menu" onClick={(e) => setMenu({ ws, anchor: e.currentTarget })}>
                <MoreIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Menu
        anchor={menu?.anchor ?? null}
        label="Workspace options"
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'Rename', onSelect: () => setRenaming(menu.ws) },
                { label: 'Duplicate', onSelect: () => void run(() => duplicateWorkspace(menu.ws.id), 'Workspace duplicated') },
                { label: 'Delete', danger: true, onSelect: () => setDeleting(menu.ws) },
              ]
            : []
        }
      />

      <NewWorkspaceDialog open={creating} onClose={() => setCreating(false)} />

      <Dialog
        open={!!renaming}
        title="Rename workspace"
        onClose={() => setRenaming(null)}
        actions={<><button className="btn" onClick={() => setRenaming(null)}>Cancel</button><button className="btn btn-primary" type="submit" form="rename-ws">Rename</button></>}
      >
        <form
          id="rename-ws"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get('name') ?? '').trim();
            const ws = renaming;
            setRenaming(null);
            if (ws && name) void run(() => renameWorkspace(ws.id, name), 'Renamed');
          }}
        >
          <label className="label mb-s2 block" htmlFor="rename-ws-name">Name</label>
          <input id="rename-ws-name" name="name" data-autofocus className="field" defaultValue={renaming?.name} maxLength={100} />
        </form>
      </Dialog>

      <Dialog
        open={!!deleting}
        title={`Delete “${deleting?.name ?? ''}”?`}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <button className="btn" data-autofocus onClick={() => setDeleting(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                const ws = deleting;
                setDeleting(null);
                if (ws) void run(() => deleteWorkspace(ws.id), 'Workspace deleted');
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>This removes the workspace and all its beats. Sounds in your library are kept.</p>
      </Dialog>
    </main>
  );
}
