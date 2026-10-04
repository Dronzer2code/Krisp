import { useEffect, useRef } from 'react';
import { getEngine } from '../../audio/context';
import { actions, useWorkspace } from '../../store/workspace';
import { Knob } from '../../ui/Knob';
import { LedButton } from '../../ui/LedButton';
import { FaderMeter } from '../../ui/FaderMeter';

// docs/UI_DESIGN.md → Master strip: EQ, Compressor (ON, threshold, ratio, attack, release, GR LED row),
// Limiter (ON, ceiling), Reverb (decay, return), stereo Meter, Fader. Plus the Reverb return strip.

const dbText = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
const GR_STEPS = [-1, -3, -6, -10]; // dB of gain reduction that light each LED

/** Gain-reduction LEDs, painted from the compressor on animation frames. */
function GrLeds() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const gr = getEngine()?.gainReduction() ?? 0;
      ref.current?.querySelectorAll<HTMLElement>('[data-gr]').forEach((el) => {
        el.dataset.on = gr <= Number(el.dataset.gr) ? '1' : '';
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="flex items-center gap-[3px]" role="img" aria-label="Compressor gain reduction">
      <span className="label mr-[2px]">GR</span>
      {GR_STEPS.map((d) => (
        <span key={d} data-gr={d} className="meter-seg h-[6px] w-[10px] rounded-[1px]" style={{ ['--seg' as string]: d <= -6 ? 'var(--led-red)' : 'var(--led-amber)' }} title={`${d} dB`} />
      ))}
    </div>
  );
}

export function ReverbStrip() {
  const reverb = useWorkspace((s) => s.workspace.mixer.master.reverb);
  return (
    <section aria-label="Reverb return" className="flex h-full min-w-[84px] max-w-[200px] flex-[1_1_84px] flex-col items-center gap-s2 rounded-md bg-panel-raised px-s1 py-s2 shadow-raised">
      <span className="label text-ink">Reverb</span>
      <Knob label="Reverb decay" shortLabel="DECAY" size="sm" value={reverb.decay} min={0.5} max={8} defaultValue={2.5} format={(v) => `${v.toFixed(1)} s`}
        onChange={(v) => actions.setMaster('gesture', { reverb: { decay: Math.round(v * 10) / 10 } })} onChangeEnd={actions.endGesture} />
      <FaderMeter label="Reverb return" valueDb={reverb.returnDb} meters={[{ label: 'Reverb return level', read: () => getEngine()?.meterOf('reverb') ?? -Infinity }]}
        onChange={(v) => actions.setMaster('gesture', { reverb: { returnDb: v } })} onChangeEnd={actions.endGesture} />
      <span className="label shrink-0">Return</span>
    </section>
  );
}

export function MasterStrip() {
  const m = useWorkspace((s) => s.workspace.mixer.master);
  const c = m.compressor;
  return (
    <section aria-label="Master" className="flex h-full shrink-0 gap-s3 rounded-md bg-panel-raised px-s3 py-s2 shadow-raised">
      <div className="flex flex-col gap-s2">
        <span className="label text-ink">Master</span>
        <div className="flex gap-[2px]">
          <Knob label="Master EQ high" shortLabel="HI" size="sm" value={m.eq.high} min={-12} max={12} defaultValue={0} format={dbText} onChange={(v) => actions.setMaster('gesture', { eq: { high: v } })} onChangeEnd={actions.endGesture} />
          <Knob label="Master EQ mid" shortLabel="MID" size="sm" value={m.eq.mid} min={-12} max={12} defaultValue={0} format={dbText} onChange={(v) => actions.setMaster('gesture', { eq: { mid: v } })} onChangeEnd={actions.endGesture} />
          <Knob label="Master EQ low" shortLabel="LO" size="sm" value={m.eq.low} min={-12} max={12} defaultValue={0} format={dbText} onChange={(v) => actions.setMaster('gesture', { eq: { low: v } })} onChangeEnd={actions.endGesture} />
        </div>
        <div className="sunken flex flex-col gap-s1 p-s2">
          <div className="flex items-center justify-between gap-s2">
            <LedButton label="Compressor on" on={c.enabled} wide size={22} onClick={() => actions.setMaster('push', { compressor: { enabled: !c.enabled } })}>COMP</LedButton>
            <GrLeds />
          </div>
          <div className="flex gap-[2px]">
            <Knob label="Compressor threshold" shortLabel="THR" size="sm" value={c.threshold} min={-60} max={0} defaultValue={-18} format={dbText} disabled={!c.enabled} onChange={(v) => actions.setMaster('gesture', { compressor: { threshold: Math.round(v) } })} onChangeEnd={actions.endGesture} />
            <Knob label="Compressor ratio" shortLabel="RATIO" size="sm" value={c.ratio} min={1} max={20} defaultValue={3} format={(v) => `${v.toFixed(1)}:1`} disabled={!c.enabled} onChange={(v) => actions.setMaster('gesture', { compressor: { ratio: Math.round(v * 10) / 10 } })} onChangeEnd={actions.endGesture} />
            <Knob label="Compressor attack" shortLabel="ATK" size="sm" value={c.attack} min={0.001} max={0.3} defaultValue={0.01} format={(v) => `${Math.round(v * 1000)} ms`} disabled={!c.enabled} onChange={(v) => actions.setMaster('gesture', { compressor: { attack: Math.round(v * 1000) / 1000 } })} onChangeEnd={actions.endGesture} />
            <Knob label="Compressor release" shortLabel="REL" size="sm" value={c.release} min={0.01} max={1} defaultValue={0.2} format={(v) => `${Math.round(v * 1000)} ms`} disabled={!c.enabled} onChange={(v) => actions.setMaster('gesture', { compressor: { release: Math.round(v * 100) / 100 } })} onChangeEnd={actions.endGesture} />
          </div>
        </div>
        <div className="sunken flex items-center gap-s3 p-s2">
          <LedButton label="Limiter on" on={m.limiter.enabled} wide size={22} onClick={() => actions.setMaster('push', { limiter: { enabled: !m.limiter.enabled } })}>LIMIT</LedButton>
          <Knob label="Limiter ceiling" shortLabel="CEIL" size="sm" value={m.limiter.ceiling} min={-12} max={0} defaultValue={-1} format={dbText} disabled={!m.limiter.enabled} onChange={(v) => actions.setMaster('gesture', { limiter: { ceiling: Math.round(v * 10) / 10 } })} onChangeEnd={actions.endGesture} />
        </div>
      </div>
      <div className="flex h-full w-[64px] flex-col items-center gap-s1">
        <FaderMeter
          label="Master volume"
          valueDb={m.volumeDb}
          meters={[
            { label: 'Master left', read: () => getEngine()?.masterLevels()[0] ?? -Infinity },
            { label: 'Master right', read: () => getEngine()?.masterLevels()[1] ?? -Infinity },
          ]}
          onChange={(v) => actions.setMaster('gesture', { volumeDb: v })}
          onChangeEnd={actions.endGesture}
        />
        <span className="label shrink-0">Volume</span>
      </div>
    </section>
  );
}
