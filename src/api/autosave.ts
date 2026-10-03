import { navigate } from '../router';
import { useUi } from '../store/ui';
import { useWorkspace } from '../store/workspace';
import { saveWorkspace } from './workspaces';

// docs/TRD.md → FRONTEND API CLIENT (autosave) + docs/PROCESS_FLOW.md SF1 and the Save status machine.
// Debounce 1500 ms after the last change; one request in flight; a change during a request saves again
// after it; failure → status error, retry with backoff 2 s, 5 s, 15 s, then wait for the next change.

const DEBOUNCE_MS = 1500;
const BACKOFF_MS = [2000, 5000, 15000];

let timer: number | null = null;
let inFlight = false;
let again = false;
let attempt = 0;
let savedRevision = 0;
let unsub: (() => void) | null = null;
let lastErrorToast = 0;

const setStatus = (saveStatus: 'saved' | 'dirty' | 'saving' | 'error', saveError: string | null = null) =>
  useUi.getState().set({ saveStatus, saveError });

function schedule(ms: number) {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void flush();
  }, ms);
}

export async function flush(): Promise<void> {
  if (inFlight) {
    again = true;
    return;
  }
  const { workspace, revision } = useWorkspace.getState();
  if (revision === savedRevision && workspace.id) return;
  inFlight = true;
  again = false;
  setStatus('saving');
  try {
    const res = await saveWorkspace(workspace);
    attempt = 0;
    savedRevision = revision;
    const current = useWorkspace.getState();
    if (!current.workspace.id) {
      current.patchMeta({ id: res.id });
      if (window.location.pathname === '/w/new') navigate(`/w/${res.id}`, true);
    }
    if (again || useWorkspace.getState().revision !== savedRevision) {
      setStatus('dirty');
      schedule(0);
    } else {
      setStatus('saved');
      useUi.getState().announce('Saved');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed';
    setStatus('error', `Not saved: ${msg}`);
    if (Date.now() - lastErrorToast > 60_000) {
      lastErrorToast = Date.now();
      useUi.getState().toast('Could not save. Your edits are kept here and will retry.', 'error');
    }
    if (attempt < BACKOFF_MS.length) schedule(BACKOFF_MS[attempt++]);
  } finally {
    inFlight = false;
  }
}

/** Starts watching the store. `immediate` saves a brand-new Workspace right away (creates its id). */
export function startAutosave(opts: { immediate?: boolean } = {}) {
  stopAutosave();
  savedRevision = useWorkspace.getState().revision;
  attempt = 0;
  setStatus('saved');
  unsub = useWorkspace.subscribe((s, prev) => {
    if (s.revision === prev.revision) return;
    attempt = 0;
    setStatus('dirty');
    schedule(DEBOUNCE_MS);
  });
  if (opts.immediate) {
    savedRevision = -1;
    void flush();
  }
}

export function stopAutosave() {
  unsub?.();
  unsub = null;
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

/** Saves pending changes before leaving the Workspace (best effort). */
export async function flushPending() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
    await flush();
  }
}
