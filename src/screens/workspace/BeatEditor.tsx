import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getPlayhead, subscribeHits, subscribePlayhead } from '../../audio/playhead';
import { emptyRow } from '../../model/defaults';
import type { Id, Slot, Step } from '../../model/types';
import { rowOf } from '../../store/ops';
import { selectedBeat } from '../../store/selectors';
import { actions, useWorkspace } from '../../store/workspace';
import { useUi } from '../../store/ui';
import { CloseIcon, RecordIcon, TrashIcon } from '../../ui/icons';
import { LedButton } from '../../ui/LedButton';
import { Pad } from '../../ui/Pad';
import { Toggle } from '../../ui/Toggle';
import { GROUP_GAP, PAD_GAP, PANEL_PAD, ROW_H, STEP_NUMS_GAP, STEP_NUMS_H } from './layout';

// docs/UI_DESIGN.md → Beat Editor; docs/PRD.md F4. Toggle, drag-paint, Shift+click / long-press velocity
// cycle, keyboard grid (roving tabindex), playhead via external store (no per-tick React render).

type Press = { cycle: boolean; pointerType: string };
type Paint = { on: boolean; pending: { slotId: Id; index: number } | null } | null;

const VEL_NAME: Record<number, string> = { 40: 'ghost', 80: 'soft', 100: 'normal', 127: 'accent' };
const ROW_LABEL_W = 92; // name label shown when the Rack is a slide-over (< 900 px)
const CLEAR_W = 28;

const PAD_MAX_H = 40; // rows are 44 px tall and line up with the Rack

function gapsWidth(n: number) {
  return (n - 1) * PAD_GAP + (Math.ceil(n / 4) - 1) * (GROUP_GAP - PAD_GAP);
}

/** Pads stretch to fill the row: width = share of the free space, height capped so rows stay 44 px. */
export function padGeometry(avail: number, n: number, minSize: number): { w: number; h: number } {
  const w = Math.max(minSize, Math.floor((avail - gapsWidth(n)) / n));
  return { w, h: Math.min(w, PAD_MAX_H) };
}

interface RowProps {
  slot: Slot;
  steps: Step[];
  length: number;
  padSize: number;
  padW: number;
  focusCol: number;
  onPress: (slotId: Id, i: number, p: Press) => void;
  onEnter: (slotId: Id, i: number) => void;
  onLongPress: (slotId: Id, i: number) => void;
  onKey: (slotId: Id, i: number, e: KeyboardEvent<HTMLButtonElement>) => void;
  onFocusCell: (slotId: Id, i: number) => void;
  onClear: (slotId: Id) => void;
}

const Row = memo(function Row({ slot, steps, length, padSize, padW, focusCol, onPress, onEnter, onLongPress, onKey, onFocusCell, onClear }: RowProps) {
  const groups = length / 4;
  return (
    <div className="flex items-center" style={{ height: ROW_H }} role="row" aria-label={slot.name}>
      <span className="mid:hidden flex shrink-0 items-center gap-s2 truncate pr-s2 text-[12px] font-semibold" style={{ width: ROW_LABEL_W }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slot.color }} />
        <span className="truncate">{slot.name}</span>
      </span>
      <div className="flex" style={{ gap: GROUP_GAP }}>
        {Array.from({ length: groups }, (_, g) => (
          <div key={g} className="flex" style={{ gap: PAD_GAP }}>
            {Array.from({ length: 4 }, (_, k) => {
              const i = g * 4 + k;
              const st = steps[i] ?? { on: false, velocity: 100, offset: 0 };
              return (
                <Pad
                  key={i}
                  cell={`${slot.id}:${i}`}
                  col={i}
                  label={`${slot.name} step ${i + 1}${st.on ? `, velocity ${st.velocity} ${VEL_NAME[st.velocity] ?? ''}` : ''}`}
                  on={st.on}
                  velocity={st.velocity}
                  offset={st.offset}
                  color={slot.color}
                  size={padSize}
                  width={padW}
                  tabIndex={focusCol === i ? 0 : -1}
                  onPress={(p) => onPress(slot.id, i, p)}
                  onEnter={() => onEnter(slot.id, i)}
                  onLongPress={() => onLongPress(slot.id, i)}
                  onKeyDown={(e) => onKey(slot.id, i, e)}
                  onFocus={() => onFocusCell(slot.id, i)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <button type="button" className="icon-btn ml-s1 h-6 w-6 shrink-0 opacity-60 hover:opacity-100" style={{ width: CLEAR_W - 4 }} aria-label={`Clear ${slot.name} row`} title="Clear row" onClick={() => onClear(slot.id)}>
        <CloseIcon size={12} />
      </button>
    </div>
  );
});

function RecordButton() {
  const record = useUi((s) => s.record);
  return (
    <LedButton label="Live record (keys A–K play Slots 1–8)" on={record} color="var(--led-red)" wide onClick={() => useUi.getState().set({ record: !record })}>
      <RecordIcon size={12} /> REC {record && <span className="normal-case tracking-normal text-ink-soft">A S D F G H J K</span>}
    </LedButton>
  );
}

export function BeatEditor() {
  const beat = useWorkspace((s) => selectedBeat(s.workspace));
  const rack = useWorkspace((s) => s.workspace.rack);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paint = useRef<Paint>(null);
  const [focus, setFocus] = useState<{ slotId: Id | null; col: number }>({ slotId: null, col: 0 });
  const [pad, setPad] = useState({ w: 34, h: 34 });
  const padSize = pad.h;
  const length = beat?.length ?? 16;

  // Pads fill the available width (min 22 desktop / 32 touch; scrolls horizontally below that).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => {
      const labelW = window.innerWidth < 900 ? ROW_LABEL_W : 0;
      const avail = el.clientWidth - labelW - CLEAR_W - 4;
      const minSize = window.matchMedia('(pointer: coarse)').matches ? 32 : 22;
      const next = padGeometry(avail, length, minSize);
      setPad((cur) => (cur.w === next.w && cur.h === next.h ? cur : next));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [length]);

  // Playhead column + hit flashes, applied to the DOM directly.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let prev = -1;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const apply = () => {
      const col = getPlayhead().beatStep;
      if (col === prev) return;
      grid.querySelectorAll(`[data-col="${prev}"]`).forEach((n) => n.removeAttribute('data-playhead'));
      if (col >= 0) grid.querySelectorAll(`[data-col="${col}"]`).forEach((n) => n.setAttribute('data-playhead', ''));
      prev = col;
    };
    apply();
    const unsubA = subscribePlayhead(apply);
    const unsubB = subscribeHits((slotId) => {
      if (reduce) return;
      const col = getPlayhead().beatStep;
      const pad = grid.querySelector<HTMLElement>(`[data-cell="${slotId}:${col}"]`);
      if (!pad) return;
      pad.classList.add('flash');
      window.setTimeout(() => pad.classList.remove('flash'), 90);
    });
    return () => {
      unsubA();
      unsubB();
    };
  }, [beat?.id, length]);

  // End a paint stroke anywhere.
  useEffect(() => {
    const up = () => {
      const p = paint.current;
      if (!p) return;
      const b = selectedBeat(useWorkspace.getState().workspace);
      if (p.pending && b) actions.toggleStep(b.id, p.pending.slotId, p.pending.index);
      paint.current = null;
      actions.endGesture();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const setCell = (beatId: Id, slotId: Id, i: number, on: boolean) =>
    actions.setStep('gesture', beatId, slotId, i, on ? { on: true, velocity: 100, offset: 0 } : { on: false });

  const onPress = useCallback((slotId: Id, i: number, p: Press) => {
    const b = selectedBeat(useWorkspace.getState().workspace);
    if (!b) return;
    if (p.cycle) {
      actions.cycleVelocity(b.id, slotId, i);
      return;
    }
    const target = !rowOf(b, slotId)[i]?.on;
    if (p.pointerType === 'touch') {
      // Touch: toggle on release so a long-press can cycle velocity instead.
      paint.current = { on: target, pending: { slotId, index: i } };
      return;
    }
    setCell(b.id, slotId, i, target);
    paint.current = { on: target, pending: null };
  }, []);

  const onEnter = useCallback((slotId: Id, i: number) => {
    const p = paint.current;
    const b = selectedBeat(useWorkspace.getState().workspace);
    if (!p || !b) return;
    if (p.pending) {
      setCell(b.id, p.pending.slotId, p.pending.index, p.on);
      p.pending = null;
    }
    setCell(b.id, slotId, i, p.on);
  }, []);

  const onLongPress = useCallback((slotId: Id, i: number) => {
    const p = paint.current;
    const b = selectedBeat(useWorkspace.getState().workspace);
    if (!b || !p?.pending || p.pending.slotId !== slotId || p.pending.index !== i) return;
    paint.current = null;
    actions.cycleVelocity(b.id, slotId, i);
    navigator.vibrate?.(10);
  }, []);

  const focusCell = (slotId: Id, col: number) => {
    setFocus({ slotId, col });
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-cell="${slotId}:${col}"]`)?.focus());
  };

  const onKey = useCallback(
    (slotId: Id, i: number, e: KeyboardEvent<HTMLButtonElement>) => {
      const w = useWorkspace.getState().workspace;
      const b = selectedBeat(w);
      if (!b) return;
      const r = w.rack.findIndex((s) => s.id === slotId);
      const move = (dr: number, dc: number) => {
        const nr = Math.max(0, Math.min(w.rack.length - 1, r + dr));
        const nc = Math.max(0, Math.min(b.length - 1, i + dc));
        focusCell(w.rack[nr].id, nc);
      };
      switch (e.key) {
        case 'ArrowRight': move(0, 1); break;
        case 'ArrowLeft': move(0, -1); break;
        case 'ArrowDown': move(1, 0); break;
        case 'ArrowUp': move(-1, 0); break;
        case 'Home': move(0, -b.length); break;
        case 'End': move(0, b.length); break;
        case ' ':
        case 'Enter':
          // Only a keyboard-focused pad takes Space/Enter; otherwise they stay transport keys.
          if (!e.currentTarget.matches(':focus-visible')) return;
          if (e.shiftKey) actions.cycleVelocity(b.id, slotId, i);
          else actions.toggleStep(b.id, slotId, i);
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const onFocusCell = useCallback((slotId: Id, i: number) => setFocus({ slotId, col: i }), []);
  const onClear = useCallback((slotId: Id) => {
    const b = selectedBeat(useWorkspace.getState().workspace);
    if (b) actions.clearRow(b.id, slotId);
  }, []);

  if (!beat) return null;
  const focusSlot = focus.slotId && rack.some((s) => s.id === focus.slotId) ? focus.slotId : rack[0]?.id;

  return (
    <section aria-label={`Beat Editor: ${beat.name}`} className="panel flex min-w-0 flex-col" style={{ padding: PANEL_PAD }}>
      <div ref={scrollRef} className="no-scrollbar min-w-0 overflow-x-auto">
        <div className="flex" style={{ height: STEP_NUMS_H, marginBottom: STEP_NUMS_GAP }} aria-hidden="true">
          <span className="mid:hidden shrink-0" style={{ width: ROW_LABEL_W }} />
          <div className="flex" style={{ gap: GROUP_GAP }}>
            {Array.from({ length: length / 4 }, (_, g) => (
              <div key={g} className="flex" style={{ gap: PAD_GAP }}>
                {Array.from({ length: 4 }, (_, k) => (
                  <span key={k} className="label flex items-end justify-center" style={{ width: pad.w, color: k === 0 ? 'var(--ink)' : undefined }}>
                    {g * 4 + k + 1}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div ref={gridRef} role="grid" aria-label={`${beat.name} steps`} aria-rowcount={rack.length} aria-colcount={length}>
          {rack.map((slot) => (
            <Row
              key={slot.id}
              slot={slot}
              steps={beat.steps[slot.id] ?? emptyRow(length)}
              length={length}
              padSize={padSize}
              padW={pad.w}
              focusCol={slot.id === focusSlot ? focus.col : -1}
              onPress={onPress}
              onEnter={onEnter}
              onLongPress={onLongPress}
              onKey={onKey}
              onFocusCell={onFocusCell}
              onClear={onClear}
            />
          ))}
        </div>
      </div>
      <div className="mt-s4 flex flex-wrap items-center gap-s4">
        <span className="label">Length</span>
        <Toggle label="Beat length" left="16" right="32" value={String(length) as '16' | '32'} onChange={(v) => actions.setBeatLength(beat.id, Number(v) as 16 | 32)} />
        <RecordButton />
        <button className="btn ml-auto" onClick={() => actions.clearBeat(beat.id)}><TrashIcon /> Clear beat</button>
      </div>
    </section>
  );
}
