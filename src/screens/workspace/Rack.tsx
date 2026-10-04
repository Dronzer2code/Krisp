import { defaultChannel } from '../../model/defaults';
import { actions, useWorkspace } from '../../store/workspace';
import { PlusIcon } from '../../ui/icons';
import { FIRST_ROW_TOP, PANEL_PAD } from './layout';
import { SlotRow } from './SlotRow';

// docs/UI_DESIGN.md → Workspace → Rack (Panel, 304 px; 56 px column of LED dots at 900–1199 px).

const FALLBACK = defaultChannel();

export function Rack({ compact = false }: { compact?: boolean }) {
  const rack = useWorkspace((s) => s.workspace.rack);
  const channels = useWorkspace((s) => s.workspace.mixer.channels);
  const add = () => actions.addSlot({ kind: 'synth', preset: 'kick' }, 'New slot');

  return (
    <section aria-label="Rack" className="panel flex h-full flex-col" style={{ padding: compact ? '0 4px' : `0 ${PANEL_PAD - 4}px 0 ${PANEL_PAD}px` }}>
      <div className="flex shrink-0 flex-col justify-end pb-[10px]" style={{ height: FIRST_ROW_TOP }}>
        {!compact && (
          <div className="flex items-baseline justify-between pr-s1">
            <h2 className="label text-ink">Rack</h2>
            <span className="label">{rack.length} slots</span>
          </div>
        )}
      </div>
      <div>
        {rack.map((slot) => (
          <SlotRow key={slot.id} slot={slot} channel={channels[slot.id] ?? FALLBACK} compact={compact} />
        ))}
      </div>
      <div className="mt-s3 pb-s4">
        {compact ? (
          <button className="icon-btn mx-auto flex" aria-label="Add slot" onClick={add}><PlusIcon /></button>
        ) : (
          <button className="btn w-full" onClick={add}><PlusIcon /> Add slot</button>
        )}
      </div>
    </section>
  );
}
