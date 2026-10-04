import { memo, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type { Lane } from '../../model/types';
import { actions, useWorkspace } from '../../store/workspace';
import { BeatIcon, MoreIcon, WaveIcon } from '../../ui/icons';
import { Menu } from '../../ui/Menu';
import { VolumeKnob } from '../../ui/VolumeKnob';
import { BAR_W, LANE_H } from './ClipView';
import { BEAT_DRAG_TYPE, SOUND_DRAG_TYPE } from './dnd';

// Song Lane: sticky header (name, type icon, Volume knob on AUDIO lanes = Mixer fader, ⋯) + clip area that accepts drops (Beat chips on BEAT lanes,
// LOOP Sounds on AUDIO lanes).

export const HEADER_W = 164;

export interface LaneRowProps {
  lane: Lane;
  width: number;
  canDelete: boolean;
  onDropAt: (lane: Lane, bar: number, e: DragEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

export const LaneRow = memo(function LaneRow({ lane, width, canDelete, onDropAt, children }: LaneRowProps) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [over, setOver] = useState<number | null>(null);
  const volumeDb = useWorkspace((s) => (lane.type === 'AUDIO' ? s.workspace.mixer.channels[lane.id]?.volumeDb ?? 0 : null));
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(lane.type === 'BEAT' ? BEAT_DRAG_TYPE : SOUND_DRAG_TYPE);
  const barAt = (e: DragEvent<HTMLDivElement>) => Math.max(0, Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / BAR_W));

  return (
    <div className="flex" style={{ height: LANE_H }} role="group" aria-label={`${lane.type === 'BEAT' ? 'Beat' : 'Audio'} lane ${lane.name}`}>
      <div className="sticky left-0 z-10 flex shrink-0 items-center gap-s2 border-r border-panel-sunken bg-panel px-s2" style={{ width: HEADER_W }}>
        <span className="text-ink-soft" title={lane.type === 'BEAT' ? 'Beat lane' : 'Audio lane'}>{lane.type === 'BEAT' ? <BeatIcon size={14} /> : <WaveIcon size={14} />}</span>
        {editing ? (
          <input
            autoFocus
            aria-label="Lane name"
            className="field h-6 min-w-0 flex-1 px-s1"
            defaultValue={lane.name}
            onBlur={(e) => {
              actions.renameLane(lane.id, e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
              e.stopPropagation();
            }}
          />
        ) : (
          <button type="button" className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
            {lane.name}
          </button>
        )}
        {volumeDb !== null && (
          <VolumeKnob label={`${lane.name} volume`} hideLabel valueDb={volumeDb}
            onChange={(db) => actions.setChannel('gesture', lane.id, { volumeDb: db })} onChangeEnd={actions.endGesture} />
        )}
        <button className="icon-btn h-6 w-6 shrink-0" aria-label={`${lane.name} options`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}><MoreIcon /></button>
        <Menu
          anchor={menu}
          label={`${lane.name} options`}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Rename', onSelect: () => setEditing(true) },
            { label: 'Delete lane', danger: true, disabled: !canDelete, onSelect: () => actions.removeLane(lane.id) },
          ]}
        />
      </div>
      <div
        data-lane={lane.id}
        data-lane-type={lane.type}
        className="relative shrink-0 border-b border-panel-sunken"
        style={{
          width,
          backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,.07) 0 1px, transparent 1px ${BAR_W}px), repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 1px, transparent 1px ${BAR_W * 4}px)`,
        }}
        onDragOver={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setOver(barAt(e));
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          setOver(null);
          onDropAt(lane, barAt(e), e);
        }}
      >
        {over !== null && <div aria-hidden="true" className="absolute bottom-1 top-1 rounded-[8px] border-2 border-dashed border-led-on" style={{ left: over * BAR_W, width: BAR_W }} />}
        {children}
      </div>
    </div>
  );
});
