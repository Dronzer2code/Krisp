import { useState } from 'react';
import { download, exportWav, type WavRange } from '../../audio/export-wav';
import { exportMidi, type MidiScope } from '../../audio/export-midi';
import { useUi } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { Dialog } from '../../ui/Dialog';
import { Led } from '../../ui/LedButton';
import { DownloadIcon } from '../../ui/icons';

// docs/PRD.md F10; docs/PROCESS_FLOW.md J10. WAV (Song or Loop region) via offline render; MIDI (Beat or Song).

type Status = { state: 'idle' } | { state: 'rendering' } | { state: 'done'; text: string } | { state: 'error'; text: string };

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string; disabled?: boolean; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-s2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.hint}
          className="chip inline-flex h-8 items-center rounded-full px-s4"
          data-selected={value === o.value || undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ExportDialog() {
  const w = useWorkspace((s) => s.workspace);
  const hasBeatClips = w.clips.some((c) => c.kind === 'beat');
  const hasClips = w.clips.length > 0;
  const [range, setRange] = useState<WavRange>(hasClips ? 'song' : 'loop');
  const [scope, setScope] = useState<MidiScope>('beat');
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const close = () => useUi.getState().set({ exportOpen: false });
  const canLoop = w.loop.enabled && w.loop.endBar > w.loop.startBar;
  const wavDisabled = range === 'song' ? !hasClips : !canLoop;

  const doWav = async () => {
    setStatus({ state: 'rendering' });
    try {
      const { blob, filename, seconds } = await exportWav(useWorkspace.getState().workspace, range);
      download(blob, filename);
      setStatus({ state: 'done', text: `Saved ${filename} (${seconds.toFixed(1)} s, ${(blob.size / 1024 / 1024).toFixed(1)} MB)` });
      useUi.getState().announce('WAV exported');
    } catch (err) {
      console.warn('export failed', err);
      setStatus({ state: 'error', text: 'Export failed. A sound may not have loaded — try again.' });
    }
  };

  const doMidi = () => {
    try {
      const { blob, filename } = exportMidi(useWorkspace.getState().workspace, scope);
      download(blob, filename);
      setStatus({ state: 'done', text: `Saved ${filename}` });
    } catch {
      setStatus({ state: 'error', text: 'MIDI export failed.' });
    }
  };

  return (
    <Dialog open title="Export" onClose={close} actions={<button className="btn" onClick={close}>Close</button>}>
      <div className="flex flex-col gap-s5">
        <section aria-label="WAV mixdown" className="flex flex-col gap-s3">
          <h3 className="label text-ink">WAV mixdown · full mixer and master</h3>
          <Choice
            name="WAV range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'song', label: `Song (${w.songBars} bars)`, disabled: !hasClips, hint: hasClips ? undefined : 'Arrange clips in the Song first' },
              { value: 'loop', label: canLoop ? `Loop region (bars ${w.loop.startBar + 1}–${w.loop.endBar})` : 'Loop region', disabled: !canLoop, hint: canLoop ? undefined : 'Drag on the Song ruler to set a loop region' },
            ]}
          />
          <button className="btn btn-primary self-start" disabled={wavDisabled || status.state === 'rendering'} onClick={() => void doWav()}>
            <Led color="var(--led-amber)" on={status.state === 'rendering'} size={6} />
            <DownloadIcon /> {status.state === 'rendering' ? 'Rendering…' : 'Export WAV'}
          </button>
          {!hasClips && <p className="text-[12px] text-ink-soft">Drag a beat onto the Song to export a mixdown.</p>}
        </section>
        <section aria-label="MIDI" className="flex flex-col gap-s3">
          <h3 className="label text-ink">MIDI · drums on channel 10 for your DAW</h3>
          <Choice
            name="MIDI scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'beat', label: 'Selected beat' },
              { value: 'song', label: 'Song', disabled: !hasBeatClips },
            ]}
          />
          <button className="btn self-start" onClick={doMidi}><DownloadIcon /> Export MIDI</button>
        </section>
        {status.state === 'done' && <p role="status" className="text-[12px]">{status.text}</p>}
        {status.state === 'error' && (
          <p role="alert" className="text-[12px] text-[#B3261E]">
            {status.text} <button className="underline" onClick={() => setStatus({ state: 'idle' })}>Try again</button>
          </p>
        )}
      </div>
    </Dialog>
  );
}
