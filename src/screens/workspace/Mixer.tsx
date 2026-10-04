import { isChannelSilenced } from '../../store/selectors';
import { LAYOUT_DEFAULTS, LAYOUT_LIMITS, useLayout } from '../../store/layout';
import { useUi } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { defaultChannel } from '../../model/defaults';
import { CloseIcon } from '../../ui/icons';
import { Splitter } from '../../ui/Splitter';
import { ChannelStrip } from './ChannelStrip';
import { MasterStrip, ReverbStrip } from './MasterStrip';

// docs/PRD.md F8; docs/UI_DESIGN.md → Mixer drawer (toggled with M): [Slots…][Audio lanes…] | [REVERB] | [MASTER].
// Height is user-resizable from the grip on its top edge (store/layout); strips fill it and the faders take the
// free height. Scrolls horizontally (no visible bar; Shift + wheel / trackpad) when the strips do not fit.
const FALLBACK = defaultChannel();

export default function Mixer() {
  const w = useWorkspace((s) => s.workspace);
  const audioLanes = w.lanes.filter((l) => l.type === 'AUDIO');
  const height = useLayout((s) => s.mixerH);
  const setSize = useLayout((s) => s.setSize);
  return (
    <section aria-label="Mixer" className="panel slide-up fixed bottom-s2 left-s2 right-s2 z-30 flex flex-col px-s3 pb-s3" style={{ height }}>
      <Splitter label="Mixer height" axis="y" direction={-1} className="h-[12px] w-full" value={height} min={LAYOUT_LIMITS.mixerH.min}
        max={Math.max(LAYOUT_LIMITS.mixerH.min, Math.min(LAYOUT_LIMITS.mixerH.max, window.innerHeight - 120))}
        onChange={(v) => setSize({ mixerH: v })} onReset={() => setSize({ mixerH: LAYOUT_DEFAULTS.mixerH })} />
      <div className="mb-s2 flex shrink-0 items-center">
        <h2 className="label text-ink">Mixer</h2>
        <span className="label ml-s3">Drag faders, turn knobs · double-click resets · drag the top edge to resize · M closes</span>
        <button className="icon-btn ml-auto h-7 w-7" aria-label="Close mixer" onClick={() => useUi.getState().set({ mixerOpen: false })}><CloseIcon /></button>
      </div>
      <div className="no-scrollbar flex min-h-0 flex-1 items-stretch gap-s2 overflow-x-auto overflow-y-hidden">
        {w.rack.map((slot) => (
          <ChannelStrip key={slot.id} id={slot.id} name={slot.name} color={slot.color} channel={w.mixer.channels[slot.id] ?? FALLBACK} silenced={isChannelSilenced(w, slot.id)} />
        ))}
        {audioLanes.map((lane) => (
          <ChannelStrip key={lane.id} id={lane.id} name={lane.name} color="#9C978D" channel={w.mixer.channels[lane.id] ?? FALLBACK} silenced={isChannelSilenced(w, lane.id)} />
        ))}
        <span aria-hidden="true" className="mx-s1 w-px shrink-0 bg-panel-sunken" />
        <ReverbStrip />
        <span aria-hidden="true" className="mx-s1 w-px shrink-0 bg-panel-sunken" />
        <MasterStrip />
      </div>
    </section>
  );
}
