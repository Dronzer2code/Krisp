import { useState } from 'react';
import { Chip } from '../ui/Chip';
import { Dialog } from '../ui/Dialog';
import { Fader, formatDb } from '../ui/Fader';
import { DownloadIcon, PlayIcon, PlusIcon, RedoIcon, SparkleIcon, StopIcon, UndoIcon } from '../ui/icons';
import { Knob } from '../ui/Knob';
import { Lcd } from '../ui/Lcd';
import { Led, LedButton } from '../ui/LedButton';
import { Meter } from '../ui/Meter';
import { Pad } from '../ui/Pad';
import { Panel } from '../ui/Panel';
import { Tabs } from '../ui/Tabs';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';

// Dev-only primitive gallery (T2). Route: /kit.

const VELS = [100, 127, 40, 80];

export default function KitDemo() {
  const [knob, setKnob] = useState(0.4);
  const [pan, setPan] = useState(0);
  const [fader, setFader] = useState(0);
  const [bpm, setBpm] = useState(90);
  const [led, setLed] = useState(true);
  const [mode, setMode] = useState<'BEAT' | 'SONG'>('BEAT');
  const [tab, setTab] = useState<'presets' | 'create' | 'upload' | 'library'>('presets');
  const [chip, setChip] = useState(0);
  const [pads, setPads] = useState<number[]>(() => Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 100 : 0)));
  const [dialog, setDialog] = useState(false);
  const [log, setLog] = useState('');
  const t0 = performance.now();
  const meterRead = () => -30 + 24 * Math.abs(Math.sin((performance.now() - t0) / 700));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-s5 p-s5">
      <Panel label="Kit" screws className="px-s6 py-s4">
        <h1 className="font-display text-[22px] tracking-[.12em]">KRISP · KIT</h1>
        <p className="label mt-s1">UI primitives (dev only)</p>
      </Panel>

      <Panel label="Controls" className="flex flex-wrap items-end gap-s6 p-s5">
        <Knob label="Swing" value={knob} min={0} max={0.6} defaultValue={0} format={(v) => `${Math.round((v / 0.6) * 100)}%`} onChange={setKnob} onChangeEnd={() => setLog('knob commit')} />
        <Knob label="Pan" size="sm" value={pan} min={-1} max={1} defaultValue={0} format={(v) => (Math.abs(v) < 0.01 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} onChange={setPan} />
        <Knob label="Disabled" value={0.5} min={0} max={1} disabled onChange={() => {}} />
        <Fader label="Volume" valueDb={fader} onChange={setFader} onChangeEnd={() => setLog('fader commit')} />
        <div className="flex items-end gap-s2">
          <Meter label="Demo meter" read={meterRead} height={120} />
          <Meter label="Demo meter R" read={meterRead} height={120} />
        </div>
        <div className="flex flex-col gap-s2">
          <span className="label">BPM</span>
          <Lcd label="Tempo" value={bpm} min={60} max={200} step={0.1} format={(v) => v.toFixed(1).padStart(5, '0')} onChange={setBpm} />
        </div>
        <Toggle label="Play mode" left="BEAT" right="SONG" value={mode} onChange={setMode} />
      </Panel>

      <Panel label="Buttons" className="flex flex-wrap items-center gap-s3 p-s5">
        <LedButton label="Mute" on={led} color="var(--led-amber)" onClick={() => setLed(!led)}>M</LedButton>
        <LedButton label="Solo" on={!led} color="var(--led-green)" onClick={() => setLed(!led)}>S</LedButton>
        <LedButton label="Play" toggle={false} wide on color="var(--led-green)"><PlayIcon /></LedButton>
        <LedButton label="Stop" toggle={false}><StopIcon /></LedButton>
        <button className="icon-btn" aria-label="Undo"><UndoIcon /></button>
        <button className="icon-btn" aria-label="Redo"><RedoIcon /></button>
        <button className="btn"><PlusIcon /> Add slot</button>
        <button className="btn btn-primary"><SparkleIcon /> Generate</button>
        <button className="btn" disabled><DownloadIcon /> Export</button>
        <Tooltip text="Saved"><span tabIndex={0} className="inline-flex items-center gap-s2"><Led color="var(--led-green)" /> <span className="label">saved</span></span></Tooltip>
        <Led color="var(--led-amber)" label="saving" />
        <Led color="var(--led-red)" label="error" />
      </Panel>

      <Panel label="Chips and tabs" className="flex flex-col gap-s4 p-s5">
        <div role="tablist" aria-label="Beats" className="flex flex-wrap gap-s2">
          {['Beat 1', 'Boom Bap', 'Fill'].map((n, i) => (
            <Chip key={n} name={n} color={['#E4572E', '#F3A712', '#2A9D8F'][i]} selected={chip === i} onSelect={() => setChip(i)} onContextMenu={() => setLog(`context menu: ${n}`)} />
          ))}
        </div>
        <Tabs label="Sounds" value={tab} onChange={setTab} items={[{ value: 'presets', label: 'Presets' }, { value: 'create', label: 'Create' }, { value: 'upload', label: 'Upload' }, { value: 'library', label: 'Library' }]} />
      </Panel>

      <Panel label="Pads" className="p-s5">
        <div className="flex gap-[6px]">
          {[0, 1, 2, 3].map((g) => (
            <div key={g} className="flex gap-[4px]">
              {pads.slice(g * 4, g * 4 + 4).map((v, k) => {
                const i = g * 4 + k;
                return (
                  <Pad
                    key={i}
                    label={`Kick step ${i + 1}${v ? `, velocity ${v}` : ''}`}
                    on={v > 0}
                    velocity={v}
                    offset={i === 4 ? 0.3 : 0}
                    color="#E4572E"
                    onPress={({ cycle }) =>
                      setPads((p) => p.map((x, j) => (j !== i ? x : cycle && x ? VELS[(VELS.indexOf(x) + 1) % 4] : x ? 0 : 100)))
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="label mt-s3">Click toggles · Shift+click cycles velocity 100 → 127 → 40 → 80</p>
      </Panel>

      <Panel label="Dialog" className="flex items-center gap-s4 p-s5">
        <button className="btn" onClick={() => setDialog(true)}>Open dialog</button>
        <output id="log" className="font-display text-[12px]">
          knob {knob.toFixed(2)} · pan {pan.toFixed(2)} · fader {formatDb(fader)} · bpm {bpm.toFixed(1)} · {mode} · {tab} · {log}
        </output>
      </Panel>

      <Dialog open={dialog} title="New workspace" onClose={() => setDialog(false)} actions={<><button className="btn" onClick={() => setDialog(false)}>Cancel</button><button className="btn btn-primary" onClick={() => setDialog(false)}>Create</button></>}>
        <label className="label mb-s2 block" htmlFor="kit-name">Name</label>
        <input id="kit-name" data-autofocus className="field" defaultValue="Untitled beat" />
      </Dialog>
    </main>
  );
}
