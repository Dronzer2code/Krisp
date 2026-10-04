import { Knob } from './Knob';
import { dbToPos, formatDb, posToDb, roundDb } from './Fader';

// Volume as a Knob: same dB curve as the Mixer Fader (−∞ … +6 dB, 0 dB at 82%), double-click = 0 dB.
// Used wherever a Fader does not fit (Rack rows, AUDIO lane headers, Transport); both edit the same value.

export interface VolumeKnobProps {
  label: string;
  shortLabel?: string;
  hideLabel?: boolean;
  valueDb: number;
  onChange: (db: number) => void;
  onChangeEnd?: () => void;
}

export function VolumeKnob({ label, shortLabel, hideLabel, valueDb, onChange, onChangeEnd }: VolumeKnobProps) {
  return (
    <Knob
      label={label}
      shortLabel={shortLabel}
      hideLabel={hideLabel}
      size="sm"
      value={dbToPos(valueDb)}
      min={0}
      max={1}
      defaultValue={dbToPos(0)}
      format={(p) => formatDb(roundDb(posToDb(p)))}
      onChange={(p) => onChange(roundDb(posToDb(p)))}
      onChangeEnd={onChangeEnd}
    />
  );
}
