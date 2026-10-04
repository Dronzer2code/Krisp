import { memo, useEffect, useRef, useState } from 'react';
import { previewSlot } from '../../audio/context';
import { useBufferVersion, getBufferStatus } from '../../audio/buffers';
import { subscribeHits } from '../../audio/playhead';
import { PALETTE } from '../../model/defaults';
import type { Channel, Slot } from '../../model/types';
import { TUNE_RANGE } from '../../model/types';
import { KIT } from '../../presets/kit';
import { useUi } from '../../store/ui';
import { actions } from '../../store/workspace';
import { MoreIcon } from '../../ui/icons';
import { Knob } from '../../ui/Knob';
import { LedButton } from '../../ui/LedButton';
import { Menu, Swatches } from '../../ui/Menu';
import { VolumeKnob } from '../../ui/VolumeKnob';
import { ROW_H } from './layout';

// docs/UI_DESIGN.md → Rack row (44 px): LED dot (flashes on hit), name (double-click rename), sound name
// (click → Sounds in replace mode), Preview pad, Tune knob, Volume knob (= Mixer fader), M/S, ⋯ (Recolor, Remove).

function SlotLed({ slot }: { slot: Slot }) {
  const ref = useRef<HTMLSpanElement>(null);
  useBufferVersion();
  const status = slot.sound.kind === 'sample' ? getBufferStatus(slot.sound.soundId, 'ONE_SHOT') : 'ready';
  useEffect(
    () =>
      subscribeHits((id) => {
        if (id !== slot.id || !ref.current) return;
        const el = ref.current;
        el.dataset.hit = '1';
        window.setTimeout(() => (el.dataset.hit = ''), 90);
      }),
    [slot.id],
  );
  const color = status === 'error' ? 'var(--led-red)' : status === 'loading' ? 'var(--led-amber)' : slot.color;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="slot-led h-[9px] w-[9px] shrink-0 rounded-full"
      style={{ background: color, ['--led' as string]: color }}
      title={status === 'error' ? 'Sound failed to load' : status === 'loading' ? 'Loading sound…' : undefined}
    />
  );
}

export const SlotRow = memo(function SlotRow({ slot, channel, compact }: { slot: Slot; channel: Channel; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const soundName = slot.sound.kind === 'synth' ? `synth · ${KIT[slot.sound.preset].label.toLowerCase()}` : slot.sound.name;

  const openReplace = () => useUi.getState().set({ replaceSlotId: slot.id, sidePanel: 'SOUNDS', soundsTab: 'library', sideOpen: true });

  if (compact) {
    return (
      <div className="group flex items-center justify-center" style={{ height: ROW_H }} title={`${slot.name} — ${soundName}`}>
        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-sm hover:bg-panel-sunken" aria-label={`Preview ${slot.name}`} onClick={() => void previewSlot(slot.id)}>
          <SlotLed slot={slot} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-s1 pr-[2px]" style={{ height: ROW_H }} role="group" aria-label={`Slot ${slot.name}`}>
      <SlotLed slot={slot} />
      <div className="ml-[2px] min-w-0 flex-1 leading-tight" title={`${slot.name} — ${soundName}`}>
        {editing ? (
          <input
            autoFocus
            aria-label="Slot name"
            className="field h-6 px-s1"
            defaultValue={slot.name}
            onBlur={(e) => {
              actions.updateSlot('push', slot.id, { name: e.target.value });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
              e.stopPropagation();
            }}
          />
        ) : (
          <button type="button" className="block w-full truncate text-left text-[12px] font-semibold" onDoubleClick={() => setEditing(true)} title="Double-click to rename" onKeyDown={(e) => e.key === 'F2' && setEditing(true)}>
            {slot.name}
          </button>
        )}
        <button type="button" className="block w-full truncate text-left text-[10px] text-ink-soft hover:text-ink" onClick={openReplace} title="Replace sound">
          {soundName}
        </button>
      </div>
      <button
        type="button"
        aria-label={`Preview ${slot.name}`}
        className="pad h-6 w-6 shrink-0"
        style={{ ['--pad-color' as string]: slot.color }}
        onPointerDown={(e) => {
          e.preventDefault();
          void previewSlot(slot.id);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            void previewSlot(slot.id);
          }
        }}
      />
      <Knob label={`${slot.name} tune`} hideLabel size="sm" value={slot.tune} min={-TUNE_RANGE} max={TUNE_RANGE} step={1} defaultValue={0}
        format={(v) => `${v > 0 ? '+' : ''}${v} st`}
        onChange={(v) => actions.updateSlot('gesture', slot.id, { tune: v })} onChangeEnd={actions.endGesture} />
      <VolumeKnob label={`${slot.name} volume`} hideLabel valueDb={channel.volumeDb}
        onChange={(db) => actions.setChannel('gesture', slot.id, { volumeDb: db })} onChangeEnd={actions.endGesture} />
      <LedButton label={`Mute ${slot.name}`} size={22} on={channel.mute} color="var(--led-amber)" onClick={() => actions.setChannel('push', slot.id, { mute: !channel.mute })}>M</LedButton>
      <LedButton label={`Solo ${slot.name}`} size={22} on={channel.solo} color="var(--led-green)" onClick={() => actions.setChannel('push', slot.id, { solo: !channel.solo })}>S</LedButton>
      <button type="button" className="icon-btn h-6 w-5" aria-label={`${slot.name} options`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>
        <MoreIcon />
      </button>
      <Menu
        anchor={menu}
        label={`${slot.name} options`}
        onClose={() => setMenu(null)}
        items={[
          { label: 'Rename', onSelect: () => setEditing(true) },
          { label: 'Replace sound', onSelect: openReplace },
          { label: 'Remove', danger: true, onSelect: () => actions.removeSlot(slot.id) },
        ]}
        footer={<Swatches colors={PALETTE} value={slot.color} onPick={(c) => { actions.updateSlot('push', slot.id, { color: c }); setMenu(null); }} />}
      />
    </div>
  );
});
