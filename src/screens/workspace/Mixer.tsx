import { isChannelSilenced } from '../../store/selectors';
import { useUi } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { defaultChannel } from '../../model/defaults';
import { CloseIcon } from '../../ui/icons';
import { ChannelStrip } from './ChannelStrip';
import { MasterStrip, ReverbStrip } from './MasterStrip';

// docs/PRD.md F8; docs/UI_DESIGN.md → Mixer drawer (toggled with M): [Slots…][Audio lanes…] | [REVERB] | [MASTER].
// Scrolls horizontally when the strips do not fit.

export const MIXER_H = 330;
const FALLBACK = defaultChannel();

export default function Mixer() {
  const w = useWorkspace((s) => s.workspace);
  const audioLanes = w.lanes.filter((l) => l.type === 'AUDIO');
  return (
    <section aria-label="Mixer" className="panel slide-up fixed bottom-s2 left-s2 right-s2 z-30 flex flex-col p-s3" style={{ height: MIXER_H }}>
      <div className="mb-s2 flex items-center">
        <h2 className="label text-ink">Mixer</h2>
        <span className="label ml-s3">Drag faders and knobs · double-click resets · M closes</span>
        <button className="icon-btn ml-auto h-7 w-7" aria-label="Close mixer" onClick={() => useUi.getState().set({ mixerOpen: false })}><CloseIcon /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch gap-s2 overflow-x-auto pb-s1">
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
