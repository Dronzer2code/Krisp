import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { getModelStatus, subscribeModelStatus, type ModelKey } from '../../ai/magenta';
import { continueBeat, humanize, morph, variations, type Candidate } from '../../ai/tools';
import { setAudition } from '../../audio/audition';
import { isPlaying, play, stop } from '../../audio/context';
import type { Beat, Slot } from '../../model/types';
import { selectedBeat } from '../../store/selectors';
import { useUi } from '../../store/ui';
import { actions, useWorkspace } from '../../store/workspace';
import { Knob } from '../../ui/Knob';
import { Led } from '../../ui/LedButton';
import { SparkleIcon } from '../../ui/icons';
import { Toggle } from '../../ui/Toggle';

// docs/UI_DESIGN.md → Side panel AI; docs/PROCESS_FLOW.md J9 + AI model state machine. Open-source Magenta
// models run in the browser; every result goes through undo history.

const LED = { NotLoaded: '#BDB7AC', Loading: 'var(--led-amber)', Ready: 'var(--led-green)', Failed: 'var(--led-red)' } as const;

function useModel(key: ModelKey) {
  return useSyncExternalStore(subscribeModelStatus, () => getModelStatus(key));
}

function ToolCard({ title, model, desc, children }: { title: string; model: ModelKey; desc: string; children: ReactNode }) {
  const st = useModel(model);
  const label = { NotLoaded: 'Model loads on first use', Loading: 'Loading model…', Ready: 'Model ready', Failed: 'Model failed to load — try again' }[st];
  return (
    <section aria-label={title} className="flex flex-col gap-s2 rounded-md bg-panel-raised p-s3 shadow-raised">
      <div className="flex items-center gap-s2">
        <Led color={LED[st]} on={st !== 'NotLoaded'} label={label} />
        <h3 className="font-semibold">{title}</h3>
        <span className="label ml-auto">{st === 'Loading' ? 'loading' : st === 'Failed' ? 'retry' : ''}</span>
      </div>
      <p className="text-[12px] text-ink-soft">{desc}</p>
      {children}
    </section>
  );
}

/** Small pad map of a candidate (rows = Slots that have hits). */
function MiniGrid({ steps, length, rack }: { steps: Beat['steps']; length: number; rack: Slot[] }) {
  const rows = rack.filter((s) => steps[s.id]?.some((x) => x.on));
  const cell = length === 32 ? 3 : 6;
  return (
    <svg aria-hidden="true" width={length * cell} height={Math.max(1, rows.length) * 6} className="block">
      {rows.map((s, r) =>
        steps[s.id].map((st, i) =>
          st.on ? <rect key={`${r}-${i}`} x={i * cell} y={r * 6} width={cell - 1} height={5} rx={1} fill={s.color} opacity={0.35 + (0.65 * st.velocity) / 127} /> : null,
        ),
      )}
    </svg>
  );
}

/** Hold-to-audition: plays the candidate in place of the selected Beat while pressed. */
function useAudition(beatId: string | undefined) {
  const started = useRef(false);
  const start = async (c: Candidate) => {
    if (!beatId) return;
    setAudition({ beatId, steps: c.steps, length: c.length });
    if (!isPlaying()) {
      if (useWorkspace.getState().workspace.playMode !== 'BEAT') actions.setPlayMode('BEAT');
      started.current = true;
      await play();
    }
  };
  const end = () => {
    setAudition(null);
    if (started.current) {
      started.current = false;
      stop();
    }
  };
  useEffect(() => () => setAudition(null), []);
  return { start, end };
}

function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(name);
    try {
      return await fn();
    } catch (err) {
      console.warn(`${name} failed`, err);
      useUi.getState().toast('Model failed to load. Check your connection and try again.', 'error');
      return null;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function Candidates({ items, rack, onApply, onAdd, audition, label }: {
  items: Candidate[]; rack: Slot[]; label: (i: number) => string;
  onApply: (c: Candidate) => void; onAdd: (c: Candidate, i: number) => void;
  audition: ReturnType<typeof useAudition>;
}) {
  const [picked, setPicked] = useState(0);
  return (
    <div className="flex flex-col gap-s2">
      <div className="grid grid-cols-2 gap-s2" role="listbox" aria-label="Candidates">
        {items.map((c, i) => (
          <button
            key={i}
            type="button"
            role="option"
            aria-selected={picked === i}
            aria-label={`${label(i)} — hold to audition`}
            className="flex min-h-[52px] items-center justify-center rounded-sm bg-graphite p-s2 touch-none"
            style={{ outline: picked === i ? '2px solid var(--led-on)' : undefined, outlineOffset: 1 }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setPicked(i);
              void audition.start(c);
            }}
            onPointerUp={audition.end}
            onPointerCancel={audition.end}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                e.stopPropagation();
                setPicked(i);
                void audition.start(c);
              }
            }}
            onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && audition.end()}
          >
            <MiniGrid steps={c.steps} length={c.length} rack={rack} />
          </button>
        ))}
      </div>
      <div className="flex gap-s2">
        <button className="btn flex-1" onClick={() => onApply(items[picked])}>Apply</button>
        <button className="btn flex-1" onClick={() => onAdd(items[picked], picked)}>Add as new beat</button>
      </div>
    </div>
  );
}

export function AIPanel() {
  const w = useWorkspace((s) => s.workspace);
  const beat = selectedBeat(w);
  const { busy, run } = useRun();
  const audition = useAudition(beat?.id);
  const [wild, setWild] = useState(0.3);
  const [twoBars, setTwoBars] = useState(false);
  const [vars, setVars] = useState<{ beatId: string; items: Candidate[] } | null>(null);
  const [morphB, setMorphB] = useState<string>('');
  const [morphs, setMorphs] = useState<{ a: string; b: string; items: Candidate[] } | null>(null);
  const [morphIdx, setMorphIdx] = useState(4);
  const ann = useUi((s) => s.announce);

  useEffect(() => {
    if (vars && vars.beatId !== beat?.id) setVars(null);
  }, [beat?.id, vars]);
  const others = w.beats.filter((b) => b.id !== beat?.id);
  const bId = others.some((b) => b.id === morphB) ? morphB : others[0]?.id ?? '';

  if (!beat) return null;

  return (
    <div className="flex flex-col gap-s3">
      <p className="text-[12px] text-ink-soft">
        Open-source Magenta models run in your browser and act on <b className="text-ink">{beat.name}</b>. Your beats never leave this device. Every result can be undone.
      </p>

      <ToolCard title="Humanize" model="groove" desc="Adds a drummer’s feel — velocity and timing — without changing which steps play.">
        <button
          className="btn btn-primary"
          disabled={!!busy}
          onClick={async () => {
            const r = await run('Humanize', () => humanize(useWorkspace.getState().workspace, beat.id));
            if (r) {
              actions.setBeatSteps(beat.id, r.steps, r.length);
              ann(`Humanized ${beat.name}`);
            }
          }}
        >
          <SparkleIcon /> {busy === 'Humanize' ? 'Humanizing…' : 'Humanize'}
        </button>
      </ToolCard>

      <ToolCard title="Variations" model="vae" desc="Four new takes close to this beat. Hold one to hear it, then apply it or keep it as a new beat.">
        <div className="flex items-center gap-s4">
          <Knob label="Wildness" size="sm" value={wild} min={0} max={1} defaultValue={0.3} format={(v) => `${Math.round(v * 100)}%`} onChange={setWild} />
          {beat.length === 16 && <Toggle label="Bars" left="1 bar" right="2 bars" value={twoBars ? '2 bars' : '1 bar'} onChange={(v) => setTwoBars(v === '2 bars')} />}
        </div>
        <button
          className="btn btn-primary"
          disabled={!!busy}
          onClick={async () => {
            const r = await run('Variations', () => variations(useWorkspace.getState().workspace, beat.id, wild, twoBars));
            if (r) {
              setVars({ beatId: beat.id, items: r });
              ann('4 variations ready');
            }
          }}
        >
          <SparkleIcon /> {busy === 'Variations' ? 'Generating…' : 'Generate'}
        </button>
        {vars && (
          <Candidates
            items={vars.items}
            rack={w.rack}
            label={(i) => `Variation ${i + 1}`}
            audition={audition}
            onApply={(c) => {
              actions.setBeatSteps(beat.id, c.steps, c.length);
              ann(`Applied variation to ${beat.name}`);
            }}
            onAdd={(c, i) => {
              actions.addBeatFromSteps(`${beat.name} var ${i + 1}`, c.steps, c.length);
              ann('Added variation as a new beat');
            }}
          />
        )}
      </ToolCard>

      <ToolCard title="Continue" model="rnn" desc="Writes bar 2 from bar 1 (the beat becomes 32 steps).">
        <button
          className="btn"
          disabled={!!busy}
          onClick={async () => {
            const r = await run('Continue', () => continueBeat(useWorkspace.getState().workspace, beat.id));
            if (r) {
              actions.setBeatSteps(beat.id, r.steps, 32);
              ann(`Continued ${beat.name} into bar 2`);
            }
          }}
        >
          <SparkleIcon /> {busy === 'Continue' ? 'Continuing…' : 'Continue'}
        </button>
      </ToolCard>

      <ToolCard title="Morph" model="vae" desc="Blends this beat into another in 9 steps. Pick a step, hold to hear it, add it as a new beat.">
        {others.length === 0 ? (
          <p className="text-[12px] text-ink-soft">Add a second beat to morph between them.</p>
        ) : (
          <>
            <label className="flex items-center gap-s2 text-[12px]">
              <span className="label">A</span> <span className="truncate font-semibold">{beat.name}</span>
              <span className="label ml-s2">to B</span>
              <select aria-label="Morph target beat" className="field h-7 min-w-0 flex-1" value={bId} onChange={(e) => setMorphB(e.target.value)}>
                {others.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <button
              className="btn"
              disabled={!!busy || !bId}
              onClick={async () => {
                const r = await run('Morph', () => morph(useWorkspace.getState().workspace, beat.id, bId));
                if (r) {
                  setMorphs({ a: beat.id, b: bId, items: r });
                  setMorphIdx(4);
                }
              }}
            >
              <SparkleIcon /> {busy === 'Morph' ? 'Morphing…' : 'Morph'}
            </button>
            {morphs && morphs.a === beat.id && (
              <div className="flex flex-col gap-s2">
                <input type="range" min={1} max={9} step={1} value={morphIdx + 1} aria-label="Morph step" onChange={(e) => setMorphIdx(Number(e.target.value) - 1)} />
                <button
                  type="button"
                  className="flex min-h-[52px] items-center justify-center rounded-sm bg-graphite p-s2 touch-none"
                  aria-label={`Morph step ${morphIdx + 1} of 9 — hold to audition`}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void audition.start(morphs.items[morphIdx]); }}
                  onPointerUp={audition.end}
                  onPointerCancel={audition.end}
                >
                  <MiniGrid steps={morphs.items[morphIdx].steps} length={morphs.items[morphIdx].length} rack={w.rack} />
                </button>
                <button className="btn" onClick={() => {
                  const c = morphs.items[morphIdx];
                  const bName = w.beats.find((x) => x.id === morphs.b)?.name ?? 'B';
                  actions.addBeatFromSteps(`${beat.name} → ${bName} ${morphIdx + 1}/9`, c.steps, c.length);
                  ann('Added morph as a new beat');
                }}>Add as new beat</button>
              </div>
            )}
          </>
        )}
      </ToolCard>
    </div>
  );
}
