import { useRef, useState } from 'react';
import { PALETTE } from '../../model/defaults';
import type { Beat } from '../../model/types';
import { PRESET_BEATS } from '../../presets/beats';
import { clipsUsingBeat } from '../../store/selectors';
import { useUi } from '../../store/ui';
import { actions, useWorkspace } from '../../store/workspace';
import { Chip } from '../../ui/Chip';
import { Dialog } from '../../ui/Dialog';
import { PlusIcon } from '../../ui/icons';
import { Menu, Swatches } from '../../ui/Menu';
import { BEAT_DRAG_TYPE } from './dnd';
import { CHIPS_H, MAIN_GAP } from './layout';

// docs/PROCESS_FLOW.md J3. Chips above the grid: select, + new, Insert preset; context menu Rename,
// Duplicate, Delete (confirms when used by clips), Change color. Chips drag onto BEAT lanes (J7).

export function BeatChips() {
  const beats = useWorkspace((s) => s.workspace.beats);
  const selectedId = useWorkspace((s) => s.workspace.selectedBeatId);
  const [menu, setMenu] = useState<{ beat: Beat; anchor: HTMLElement } | null>(null);
  const [presetMenu, setPresetMenu] = useState<HTMLElement | null>(null);
  const [renaming, setRenaming] = useState<Beat | null>(null);
  const [deleting, setDeleting] = useState<{ beat: Beat; clips: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const askDelete = (beat: Beat) => {
    const clips = clipsUsingBeat(useWorkspace.getState().workspace, beat.id);
    if (clips > 0) setDeleting({ beat, clips });
    else actions.deleteBeat(beat.id);
  };

  return (
    <div className="flex min-w-0 items-center gap-s2" style={{ height: CHIPS_H, marginBottom: MAIN_GAP }}>
      <div ref={listRef} role="tablist" aria-label="Beats" className="flex min-w-0 items-center gap-s2 overflow-x-auto px-[2px] py-s1">
        {beats.map((b, i) => (
          <Chip
            key={b.id}
            name={b.name}
            color={b.color}
            selected={b.id === selectedId}
            onSelect={() => actions.selectBeat(b.id)}
            onContextMenu={(anchor) => setMenu({ beat: b, anchor })}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(BEAT_DRAG_TYPE, b.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onKeyDown={(e) => {
              const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (n) {
                e.preventDefault();
                const next = beats[(i + n + beats.length) % beats.length];
                actions.selectBeat(next.id);
                requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[aria-selected=true]')?.focus());
              }
              if (e.key === 'F2') setRenaming(b);
              if (e.key === 'Delete') askDelete(b);
            }}
          />
        ))}
      </div>
      <button className="icon-btn shrink-0" aria-label="New beat" title="New beat" onClick={() => actions.addBeat()}>
        <PlusIcon />
      </button>
      <button className="btn shrink-0" aria-haspopup="menu" onClick={(e) => setPresetMenu(e.currentTarget)}>Insert preset</button>
      <span className="label ml-auto hidden shrink-0 wide:inline">Right-click a beat for options · drag to the Song</span>

      <Menu
        anchor={presetMenu}
        label="Insert preset"
        onClose={() => setPresetMenu(null)}
        items={PRESET_BEATS.map((p) => ({
          label: `${p.name} · ${p.bpm} BPM`,
          onSelect: () => {
            actions.insertPresetBeat(p.id);
            useUi.getState().announce(`Inserted preset ${p.name}`);
          },
        }))}
      />

      <Menu
        anchor={menu?.anchor ?? null}
        label={menu ? `${menu.beat.name} options` : 'Beat options'}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'Rename', onSelect: () => setRenaming(menu.beat) },
                { label: 'Duplicate', onSelect: () => actions.duplicateBeat(menu.beat.id) },
                { label: 'Delete', danger: true, disabled: beats.length <= 1, onSelect: () => askDelete(menu.beat) },
              ]
            : []
        }
        footer={menu && <Swatches colors={PALETTE} value={menu.beat.color} onPick={(c) => { actions.recolorBeat(menu.beat.id, c); setMenu(null); }} />}
      />

      <Dialog
        open={!!renaming}
        title="Rename beat"
        onClose={() => setRenaming(null)}
        actions={
          <>
            <button className="btn" onClick={() => setRenaming(null)}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="rename-beat">Rename</button>
          </>
        }
      >
        <form
          id="rename-beat"
          onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name');
            if (renaming && typeof name === 'string') actions.renameBeat(renaming.id, name);
            setRenaming(null);
          }}
        >
          <label className="label mb-s2 block" htmlFor="beat-name">Name</label>
          <input id="beat-name" name="name" data-autofocus className="field" defaultValue={renaming?.name} maxLength={40} />
        </form>
      </Dialog>

      <Dialog
        open={!!deleting}
        title={`Delete “${deleting?.beat.name ?? ''}”?`}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <button className="btn" data-autofocus onClick={() => setDeleting(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (deleting) actions.deleteBeat(deleting.beat.id);
                setDeleting(null);
              }}
            >
              Delete beat
            </button>
          </>
        }
      >
        <p>Also removes {deleting?.clips} {deleting?.clips === 1 ? 'clip' : 'clips'} from the Song. You can undo this.</p>
      </Dialog>
    </div>
  );
}
