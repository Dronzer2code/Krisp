import { memo, useCallback } from 'react';
import { getEngine } from '../../audio/context';
import type { Channel, Id } from '../../model/types';
import { actions } from '../../store/workspace';
import { Knob } from '../../ui/Knob';
import { LedButton } from '../../ui/LedButton';
import { FaderMeter } from '../../ui/FaderMeter';

// docs/UI_DESIGN.md → Mixer channel strip: name + colour LED, EQ (H/M/L, sm), Send, Pan, Meter beside Fader, M/S.
// The strip fills the drawer height (the Fader takes the free height) and grows from 84 px to share the free width.

const panText = (v: number) => (Math.abs(v) < 0.01 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);
const dbText = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;

export const ChannelStrip = memo(function ChannelStrip({ id, name, color, channel, silenced }: { id: Id; name: string; color: string; channel: Channel; silenced: boolean }) {
  const set = useCallback((patch: Partial<Channel>) => actions.setChannel('gesture', id, patch), [id]);
  const read = useCallback(() => getEngine()?.meterOf(id) ?? -Infinity, [id]);
  return (
    <section aria-label={`${name} channel`} className="flex h-full min-w-[84px] max-w-[200px] flex-[1_1_84px] flex-col items-center gap-s1 rounded-md bg-panel-raised px-s1 py-s2 shadow-raised" style={{ opacity: silenced ? 0.6 : 1 }}>
      <div className="flex w-full items-center gap-s1 px-s1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
        <span className="truncate text-[11px] font-semibold" title={name}>{name}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-[2px]">
        <Knob label={`${name} EQ high`} shortLabel="HI" size="sm" value={channel.eq.high} min={-12} max={12} defaultValue={0} format={dbText} onChange={(v) => set({ eq: { ...channel.eq, high: v } })} onChangeEnd={actions.endGesture} />
        <Knob label={`${name} EQ mid`} shortLabel="MID" size="sm" value={channel.eq.mid} min={-12} max={12} defaultValue={0} format={dbText} onChange={(v) => set({ eq: { ...channel.eq, mid: v } })} onChangeEnd={actions.endGesture} />
        <Knob label={`${name} EQ low`} shortLabel="LO" size="sm" value={channel.eq.low} min={-12} max={12} defaultValue={0} format={dbText} onChange={(v) => set({ eq: { ...channel.eq, low: v } })} onChangeEnd={actions.endGesture} />
        <Knob label={`${name} reverb send`} shortLabel="SEND" size="sm" value={channel.reverbSend} min={0} max={1} defaultValue={0} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ reverbSend: v })} onChangeEnd={actions.endGesture} />
      </div>
      <Knob label={`${name} pan`} shortLabel="PAN" size="sm" value={channel.pan} min={-1} max={1} defaultValue={0} format={panText} onChange={(v) => set({ pan: v })} onChangeEnd={actions.endGesture} />
      <FaderMeter label={`${name} volume`} valueDb={channel.volumeDb} meters={[{ label: `${name} level`, read }]} onChange={(v) => set({ volumeDb: v })} onChangeEnd={actions.endGesture} />
      <div className="flex shrink-0 gap-s1">
        <LedButton label={`Mute ${name}`} size={24} on={channel.mute} color="var(--led-amber)" onClick={() => actions.setChannel('push', id, { mute: !channel.mute })}>M</LedButton>
        <LedButton label={`Solo ${name}`} size={24} on={channel.solo} color="var(--led-green)" onClick={() => actions.setChannel('push', id, { solo: !channel.solo })}>S</LedButton>
      </div>
    </section>
  );
});
