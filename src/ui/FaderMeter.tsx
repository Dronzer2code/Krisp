import { Fader, FADER_CAP_H } from './Fader';
import { Meter } from './Meter';
import { useElementHeight } from './useElementHeight';

// Mixer volume section: Fader + its Meter(s), filling the free height of a strip (the Mixer drawer is
// resizable, so faders grow and shrink with it). Meters span the fader's travel.

export interface FaderMeterProps {
  label: string;
  valueDb: number;
  meters: { label: string; read: () => number }[];
  onChange: (db: number) => void;
  onChangeEnd?: () => void;
}

const MIN_FADER = 64;

export function FaderMeter({ label, valueDb, meters, onChange, onChangeEnd }: FaderMeterProps) {
  const [ref, h] = useElementHeight<HTMLDivElement>(120);
  const height = Math.max(MIN_FADER, h);
  return (
    <div ref={ref} className="flex min-h-0 w-full flex-1 justify-center gap-[3px] overflow-hidden">
      <Fader label={label} hideLabel valueDb={valueDb} height={height} onChange={onChange} onChangeEnd={onChangeEnd} />
      <div className="flex gap-[2px]" style={{ marginTop: FADER_CAP_H / 2 }}>
        {meters.map((m) => <Meter key={m.label} label={m.label} read={m.read} height={height - FADER_CAP_H} />)}
      </div>
    </div>
  );
}
