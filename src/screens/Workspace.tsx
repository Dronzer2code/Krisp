import { lazy, Suspense, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { flushPending, startAutosave, stopAutosave } from '../api/autosave';
import { getWorkspace } from '../api/workspaces';
import { prefetchBuffers, stop, warmUpOnFirstGesture } from '../audio/context';
import { navigate } from '../router';
import { LAYOUT_DEFAULTS, LAYOUT_LIMITS, useLayout } from '../store/layout';
import { useUi } from '../store/ui';
import { useWorkspace } from '../store/workspace';
import { Panel } from '../ui/Panel';
import { Splitter } from '../ui/Splitter';
import { BeatChips } from './workspace/BeatChips';
import { BeatEditor } from './workspace/BeatEditor';
import { Rack } from './workspace/Rack';
import { ShortcutsOverlay } from './workspace/ShortcutsOverlay';
import { SidePanel } from './workspace/SidePanel';
import { Song } from './workspace/Song';
import { TransportBar } from './workspace/TransportBar';
import { useShortcuts } from './workspace/useShortcuts';

const Mixer = lazy(() => import('./workspace/Mixer'));
const ExportDialog = lazy(() => import('./workspace/ExportDialog'));

// docs/UI_DESIGN.md → Workspace (desktop ≥ 1200 px; Rack collapses at 900–1199; sheets below 900).

const MIN_MAIN = 520;
const WIDE_CHROME = 24 + 24; // page padding + two 12 px splitters

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

type Load = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

function useLoadWorkspace(id: string): Load {
  const [load, setLoad] = useState<Load>(() => (id === 'new' || useWorkspace.getState().workspace.id === id ? { state: 'ready' } : { state: 'loading' }));

  useEffect(() => {
    let cancelled = false;
    const current = useWorkspace.getState().workspace;
    if (id === 'new' || current.id === id) {
      setLoad({ state: 'ready' });
      prefetchBuffers(current);
      startAutosave({ immediate: id === 'new' && !current.id });
    } else {
      setLoad({ state: 'loading' });
      getWorkspace(id)
        .then((w) => {
          if (cancelled) return;
          useWorkspace.getState().load(w);
          prefetchBuffers(w);
          startAutosave();
          setLoad({ state: 'ready' });
        })
        .catch((err) => {
          if (cancelled) return;
          setLoad({ state: 'error', message: err instanceof ApiError && err.status === 404 ? 'This workspace does not exist any more.' : 'Could not open this workspace.' });
        });
    }
    return () => {
      cancelled = true;
      void flushPending();
      stopAutosave();
      stop();
    };
  }, [id]);
  return load;
}

export default function Workspace({ id }: { id: string }) {
  const load = useLoadWorkspace(id);
  const mixerOpen = useUi((s) => s.mixerOpen);
  const sideOpen = useUi((s) => s.sideOpen);
  const rackOpen = useUi((s) => s.rackOpen);
  const exportOpen = useUi((s) => s.exportOpen);
  const { rackW: savedRackW, sideW: savedSideW, mixerH, setSize } = useLayout();
  // The beat grid keeps at least MIN_MAIN px: saved widths give way on narrower windows (they are not overwritten).
  const viewportW = useViewportWidth();
  const spare = viewportW - WIDE_CHROME - MIN_MAIN;
  const sideW = Math.max(LAYOUT_LIMITS.sideW.min, Math.min(savedSideW, spare - LAYOUT_LIMITS.rackW.min));
  const rackW = Math.max(LAYOUT_LIMITS.rackW.min, Math.min(savedRackW, spare - sideW));
  const name = useWorkspace((s) => s.workspace.name);
  useShortcuts();
  useEffect(() => warmUpOnFirstGesture(), []);

  useEffect(() => {
    document.title = `${name} · Pocket`;
    return () => {
      document.title = 'Pocket';
    };
  }, [name]);

  if (load.state === 'loading') {
    return <main className="flex min-h-screen items-center justify-center"><p className="label" role="status">Opening workspace…</p></main>;
  }
  if (load.state === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center p-s4">
        <Panel label="Error" className="flex flex-col items-center gap-s4 p-s6 text-center">
          <p className="title">{load.message}</p>
          <button className="btn" onClick={() => navigate('/')}>Back to Home</button>
        </Panel>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-s3 p-s3" style={{ paddingBottom: mixerOpen ? mixerH + 16 : undefined }}>
      <TransportBar />
      <div
        className="grid min-h-0 flex-1 items-start gap-s3 grid-cols-1 mid:grid-cols-[56px_minmax(0,1fr)] wide:gap-x-0 wide:grid-cols-[var(--rack-w)_12px_minmax(0,1fr)_12px_var(--side-w)]"
        style={{ ['--rack-w' as string]: `${rackW}px`, ['--side-w' as string]: `${sideW}px` }}
      >
        {/* Rack: full at ≥1200 (resizable), compact at 900–1199, slide-over sheet below 900 */}
        <div className="hidden wide:block wide:self-stretch"><Rack /></div>
        <Splitter label="Rack width" axis="x" className="hidden wide:flex wide:self-stretch" value={rackW} min={LAYOUT_LIMITS.rackW.min} max={Math.max(LAYOUT_LIMITS.rackW.min, Math.min(LAYOUT_LIMITS.rackW.max, spare - sideW))}
          onChange={(v) => setSize({ rackW: Math.min(v, spare - sideW) })} onReset={() => setSize({ rackW: LAYOUT_DEFAULTS.rackW })} />
        <div className="hidden mid:block mid:self-stretch wide:hidden"><Rack compact /></div>

        <main className="flex min-w-0 flex-col gap-s3" aria-label="Beat and Song">
          <div className="flex items-center gap-s2 mid:hidden">
            <button className="btn" onClick={() => useUi.getState().set({ rackOpen: true })}>Rack</button>
          </div>
          <div>
            <BeatChips />
            <BeatEditor />
          </div>
          <Song />
        </main>

        <Splitter label="Side panel width" axis="x" direction={-1} className="hidden wide:flex wide:self-stretch" value={sideW} min={LAYOUT_LIMITS.sideW.min} max={Math.max(LAYOUT_LIMITS.sideW.min, Math.min(LAYOUT_LIMITS.sideW.max, spare - rackW))}
          onChange={(v) => setSize({ sideW: Math.min(v, spare - rackW) })} onReset={() => setSize({ sideW: LAYOUT_DEFAULTS.sideW })} />
        <aside className="hidden wide:block wide:self-stretch" aria-label="Sounds and AI"><SidePanel /></aside>
      </div>

      {/* Slide-overs for narrower screens */}
      {sideOpen && (
        <div className="fixed inset-0 z-40 wide:hidden" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && useUi.getState().set({ sideOpen: false })} style={{ background: 'rgba(40,38,34,.25)' }}>
          <aside className="slide-in-right absolute bottom-0 right-0 top-0 w-[min(360px,92vw)] overflow-y-auto p-s3" aria-label="Sounds and AI"><SidePanel onClose={() => useUi.getState().set({ sideOpen: false })} /></aside>
        </div>
      )}
      {rackOpen && (
        <div className="fixed inset-0 z-40 mid:hidden" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && useUi.getState().set({ rackOpen: false })} style={{ background: 'rgba(40,38,34,.25)' }}>
          <div className="slide-in-left absolute bottom-0 left-0 top-0 w-[min(340px,92vw)] overflow-y-auto p-s3"><Rack /></div>
        </div>
      )}

      {mixerOpen && <Suspense fallback={null}><Mixer /></Suspense>}
      {exportOpen && <Suspense fallback={null}><ExportDialog /></Suspense>}
      <ShortcutsOverlay />
    </div>
  );
}
