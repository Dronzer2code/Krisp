import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SynthPreset } from '../model/types';
import { Chip } from '../ui/Chip';
import { Fader, formatDb } from '../ui/Fader';
import { DownloadIcon, PlayIcon, SearchIcon, SparkleIcon } from '../ui/icons';
import { Knob } from '../ui/Knob';
import { Lcd } from '../ui/Lcd';
import { Led, LedButton } from '../ui/LedButton';
import { Meter } from '../ui/Meter';
import { Pad } from '../ui/Pad';
import { Toggle } from '../ui/Toggle';

// Home → "How to use Krisp": a hands-on tutorial on manuscript paper. Headings and notes are hand-lettered
// (Petaluma Script); every control in it is the real UI primitive, so trying it here is trying it in the app.

const HIDE_KEY = 'pocket.guide.hidden';
const VEL = [100, 127, 40, 80];

/** Plays a kit sound without loading the audio engine until the first tap (keeps Home light). */
function hear(preset: SynthPreset) {
  void import('../audio/context').then((m) => m.ensureAudioStarted()).then((e) => e.previewPreset(preset));
}

function Hand({ children, className = '', as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'h2' | 'h3' | 'p' }) {
  return <Tag className={`font-hand ${className}`}>{children}</Tag>;
}

/** Little hand-drawn arrow pointing at a control. */
function Arrow({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg aria-hidden="true" width="44" height="22" viewBox="0 0 44 22" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M2 4 C 14 2, 26 6, 38 15" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M31 16 L39 16 L36 9" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Note({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="26" viewBox="0 0 18 26" className={className}>
      <ellipse cx="6.5" cy="21" rx="5.5" ry="4" transform="rotate(-22 6.5 21)" fill="var(--ink)" />
      <path d="M11.4 19.5 V2 C 13 5, 17 6, 16 11" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** One tutorial step on its own sheet of manuscript paper. */
function Step({ n, title, children, demo }: { n: number; title: string; children: ReactNode; demo: ReactNode }) {
  return (
    <li className="guide-sheet relative flex flex-col gap-s3 rounded-lg p-s5 pt-s4">
      <div className="flex items-baseline gap-s3">
        <Hand className="text-[40px] leading-none text-led-on">{n}</Hand>
        <Hand as="h3" className="text-[24px] leading-tight text-ink">{title}</Hand>
      </div>
      <div className="text-[13px] leading-relaxed text-ink">{children}</div>
      <div className="guide-well mt-auto flex min-h-[92px] flex-wrap items-center gap-s3 rounded-md p-s3">{demo}</div>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="lcd lcd-sm inline-flex h-[22px] min-w-[22px] items-center justify-center px-[6px] align-middle text-[11px]">{children}</kbd>;
}

// ── Live demos ──

function PadDemo() {
  const [steps, setSteps] = useState<number[]>([100, 0, 0, 0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 0, 0]);
  return (
    <div className="flex flex-col gap-s2">
      <div className="grid grid-cols-2 gap-x-[8px] gap-y-[6px]">
        {[0, 1, 2, 3].map((g) => (
          <div key={g} className="flex gap-[3px]">
            {steps.slice(g * 4, g * 4 + 4).map((v, k) => {
              const i = g * 4 + k;
              return (
                <Pad
                  key={i}
                  size={22}
                  label={`Kick step ${i + 1}${v ? `, velocity ${v}` : ''}`}
                  on={v > 0}
                  velocity={v}
                  color="#E4572E"
                  onPress={({ cycle }) => {
                    setSteps((s) => s.map((x, j) => (j !== i ? x : cycle && x ? VEL[(VEL.indexOf(x) + 1) % 4] : x ? 0 : 100)));
                    if (!v || cycle) hear('kick');
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <Hand className="text-[15px] text-ink-soft">tap a pad · Shift + tap to change how hard it hits</Hand>
    </div>
  );
}

function FeelDemo() {
  const [swing, setSwing] = useState(0.15);
  return (
    <>
      <Knob label="Swing" value={swing} min={0} max={0.6} defaultValue={0} format={(v) => `${Math.round((v / 0.6) * 100)}%`} onChange={setSwing} />
      <Arrow flip className="-ml-s2" />
      <div className="flex flex-col gap-s1">
        <div className="flex items-center gap-s2">
          {[40, 80, 100, 127].map((v) => (
            <span key={v} className="flex flex-col items-center gap-[2px]">
              <Pad size={20} label={`Velocity ${v}`} on velocity={v} color="#2A9D8F" onPress={() => hear('chh')} />
              <span className="label">{({ 40: 'ghost', 80: 'soft', 100: 'normal', 127: 'accent' } as Record<number, string>)[v]}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function PlayDemo() {
  const [bpm, setBpm] = useState(90);
  const [mode, setMode] = useState<'BEAT' | 'SONG'>('BEAT');
  const [on, setOn] = useState(false);
  return (
    <>
      <LedButton label="Play" toggle={false} on={on} color="var(--led-green)" size={32} onClick={() => { setOn(!on); if (!on) hear('kick'); }}><PlayIcon /></LedButton>
      <Lcd label="Tempo" value={bpm} min={60} max={200} step={0.1} format={(v) => v.toFixed(1).padStart(5, '0')} onChange={setBpm} />
      <Toggle label="Play mode" left="BEAT" right="SONG" value={mode} onChange={setMode} />
    </>
  );
}

function AiDemo() {
  return (
    <div className="flex flex-wrap items-center gap-s3">
      <button type="button" className="btn btn-primary" tabIndex={-1} aria-hidden="true"><SparkleIcon /> Humanize</button>
      <div className="grid grid-cols-2 gap-[4px]" aria-hidden="true">
        {[0, 1, 2, 3].map((k) => (
          <span key={k} className="flex h-[22px] w-[58px] items-center gap-[2px] rounded-[4px] bg-graphite px-[4px]">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} className="h-[6px] flex-1 rounded-[1px]" style={{ background: (i + k) % 3 === 0 ? '#E4572E' : (i * k) % 4 === 1 ? '#F3A712' : 'transparent' }} />
            ))}
          </span>
        ))}
      </div>
      <Hand className="text-[15px] text-ink-soft">hold a variation to hear it</Hand>
    </div>
  );
}

function SoundDemo() {
  return (
    <div className="flex w-full flex-col gap-s2" aria-hidden="true">
      <div className="field flex items-center gap-s2 text-ink-soft"><SearchIcon /> warm dusty kick</div>
      <div className="flex items-center gap-s2">
        <span className="text-[12px] font-semibold">Dusty vinyl kick</span>
        <span className="rounded-[4px] bg-led-on px-[5px] py-[2px] text-[9px] font-semibold uppercase tracking-[.06em] text-white">vector</span>
        <span className="rounded-[4px] bg-led-on px-[5px] py-[2px] text-[9px] font-semibold uppercase tracking-[.06em] text-white">keyword</span>
        <span className="btn ml-auto h-7 px-s3">Use</span>
      </div>
    </div>
  );
}

function SongDemo() {
  const [sel, setSel] = useState(0);
  const beats = [{ n: 'Intro', c: '#E4572E' }, { n: 'Main', c: '#F3A712' }, { n: 'Fill', c: '#2A9D8F' }];
  return (
    <div className="flex w-full flex-col gap-s2">
      <div role="tablist" aria-label="Example beats" className="flex gap-s2">
        {beats.map((b, i) => <Chip key={b.n} name={b.n} color={b.c} selected={sel === i} onSelect={() => setSel(i)} />)}
      </div>
      <div className="relative h-[30px] w-full rounded-[6px] bg-panel-sunken" aria-hidden="true"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 1px, transparent 1px 28px)' }}>
        {[{ l: 0, w: 4, c: '#E4572E' }, { l: 4, w: 8, c: '#F3A712' }, { l: 12, w: 2, c: '#2A9D8F' }].map((x, i) => (
          <span key={i} className="absolute top-[3px] h-[24px] rounded-[5px]" style={{ left: x.l * 14 + 1, width: x.w * 14 - 2, background: `color-mix(in srgb, ${x.c} 85%, transparent)` }} />
        ))}
      </div>
    </div>
  );
}

function MixDemo() {
  const [db, setDb] = useState(0);
  const [lim, setLim] = useState(true);
  const t0 = performance.now();
  return (
    <>
      <div className="flex items-end gap-[3px]">
        <Fader label="Volume" valueDb={db} height={96} onChange={setDb} />
        <div className="mb-[18px]"><Meter label="Demo level" height={70} read={() => -24 + 18 * Math.abs(Math.sin((performance.now() - t0) / 500)) + db / 2} /></div>
      </div>
      <div className="flex flex-col gap-s2">
        <LedButton label="Limiter" on={lim} wide onClick={() => setLim(!lim)}>LIMIT</LedButton>
        <span className="btn h-8" aria-hidden="true"><DownloadIcon /> Export</span>
        <span className="font-display text-[11px] text-ink-soft">{formatDb(db)}</span>
      </div>
    </>
  );
}

// ── Controls cheat sheet ──

function ControlCard({ name, what, how, children }: { name: string; what: string; how: string; children: ReactNode }) {
  return (
    <li className="guide-sheet flex flex-col items-center gap-s2 rounded-md p-s3 text-center">
      <div className="flex h-[70px] items-center justify-center">{children}</div>
      <Hand as="h3" className="text-[20px] leading-none text-ink">{name}</Hand>
      <p className="text-[12px] leading-snug text-ink">{what}</p>
      <p className="label leading-snug">{how}</p>
    </li>
  );
}

function Controls() {
  const [k, setK] = useState(0.5);
  const [f, setF] = useState(-6);
  const [led, setLed] = useState(true);
  const [p, setP] = useState(100);
  const [v, setV] = useState(120);
  const [t, setT] = useState<'16' | '32'>('16');
  const t0 = performance.now();
  return (
    <ul className="grid gap-s4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      <ControlCard name="Pad" what="One step of your beat. Lit = it plays." how="Tap · Shift+tap = velocity">
        <Pad size={36} label="Pad" on={p > 0} velocity={p || 100} color="#9B7EDE" onPress={({ cycle }) => { setP(cycle && p ? VEL[(VEL.indexOf(p) + 1) % 4] : p ? 0 : 100); hear('rim'); }} />
      </ControlCard>
      <ControlCard name="Knob" what="Turns a value up or down — swing, pan, EQ." how="Drag around · double-click resets">
        <Knob label="Knob" hideLabel value={k} min={0} max={1} defaultValue={0.5} format={(x) => `${Math.round(x * 100)}%`} onChange={setK} />
      </ControlCard>
      <ControlCard name="Fader" what="Loudness of a channel in dB." how="Drag up/down · double-click = 0 dB">
        <Fader label="Fader" hideLabel valueDb={f} height={70} onChange={setF} />
      </ControlCard>
      <ControlCard name="LED button" what="An on/off switch. The light shows it’s on." how="Click · M mutes, S solos">
        <LedButton label="LED button" on={led} color="var(--led-amber)" size={34} onClick={() => setLed(!led)}>M</LedButton>
      </ControlCard>
      <ControlCard name="LCD" what="A number you can set exactly, like BPM." how="Drag · or click and type">
        <Lcd label="LCD" value={v} min={60} max={200} step={1} format={(x) => String(Math.round(x)).padStart(3, '0')} onChange={setV} />
      </ControlCard>
      <ControlCard name="Meter" what="How loud it is right now. Red = too hot." how="Just watch it">
        <Meter label="Meter" height={64} read={() => -30 + 30 * Math.abs(Math.sin((performance.now() - t0) / 600))} />
      </ControlCard>
      <ControlCard name="Switch" what="Picks one of two — 16 or 32 steps, BEAT or SONG." how="Click or use arrow keys">
        <Toggle label="Switch" left="16" right="32" value={t} onChange={setT} />
      </ControlCard>
      <ControlCard name="Save light" what="Green = saved. Amber = saving. Red = not saved yet." how="Saves by itself">
        <span className="flex items-center gap-s2"><Led color="var(--led-green)" size={10} /><Led color="var(--led-amber)" size={10} /><Led color="var(--led-red)" size={10} /></span>
      </ControlCard>
    </ul>
  );
}

export function Guide() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? '1' : '0');
    } catch {
      /* storage blocked: only for this visit */
    }
  };

  return (
    <section aria-labelledby="guide-title" className="guide-paper mt-s4 flex flex-col gap-s5 rounded-lg p-s5 mid:p-s6">
      <header className="flex flex-wrap items-end gap-x-s4 gap-y-s2">
        <Note className="mb-[6px]" />
        <div>
          <Hand as="h2" className="text-[38px] leading-none text-ink"><span id="guide-title">Your first beat, step by step</span></Hand>
          <Hand as="p" className="mt-s1 text-[18px] text-ink-soft">eight moves from a blank page to a WAV in your DAW</Hand>
        </div>
        <button className="btn ml-auto" aria-expanded={!hidden} aria-controls="guide-body" onClick={toggle}>{hidden ? 'Show the guide' : 'Hide the guide'}</button>
      </header>

      {!hidden && (
        <div id="guide-body" className="flex flex-col gap-s6">
          <ol className="grid gap-s4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            <Step n={1} title="Start a workspace" demo={<><button className="btn btn-primary" tabIndex={-1} aria-hidden="true">+ New workspace</button><Arrow flip /><Hand className="text-[16px] text-ink-soft">pick Empty, or Lo-fi, Trap, House…</Hand></>}>
              Hit <b>New workspace</b>, give it a name and start from <b>Empty</b> or one of 8 preset beats. A workspace holds everything: your sounds, beats, song and mix.
            </Step>
            <Step n={2} title="Tap in a beat" demo={<PadDemo />}>
              Each row is a sound in your <b>Rack</b> (Kick, Snare, Hats…), each pad one 16th note. Click to switch a step on, drag across a row to paint. Try it on the pads below.
            </Step>
            <Step n={3} title="Give it feel" demo={<FeelDemo />}>
              <b>Shift+click</b> a lit pad to cycle how hard it hits: ghost → soft → normal → accent. Turn <b>Swing</b> to push every second 16th late — that’s the bounce.
            </Step>
            <Step n={4} title="Press play" demo={<PlayDemo />}>
              Press <Kbd>Space</Kbd> to play and stop. Drag the <b>BPM</b> screen or tap <b>TAP</b> in time to set the tempo. <b>BEAT</b> loops the beat you’re editing; <b>SONG</b> plays your arrangement.
            </Step>
            <Step n={5} title="Let the AI jam" demo={<AiDemo />}>
              Open the <b>AI</b> tab. <b>Humanize</b> adds a drummer’s timing, <b>Variations</b> offers four new takes, <b>Continue</b> writes bar 2, <b>Morph</b> blends two beats. It all runs in your browser, and <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undoes it.
            </Step>
            <Step n={6} title="Find your sound" demo={<SoundDemo />}>
              In <b>Sounds</b>: <b>Create</b> one by describing it (“dusty vinyl kick, short”), <b>Upload</b> your own WAV/MP3, or search the <b>Library</b> by name or by vibe. Click a Rack sound name to swap it.
            </Step>
            <Step n={7} title="Arrange the song" demo={<SongDemo />}>
              Make a few beats (chips above the grid), then drag them onto the <b>Song</b>. Drag a clip’s right edge to repeat it, drag loops onto an <b>Audio</b> lane, and drag on the ruler to loop a section.
            </Step>
            <Step n={8} title="Mix it & export" demo={<MixDemo />}>
              Press <Kbd>M</Kbd> for the <b>Mixer</b>: faders, pan, EQ, reverb send, then the Master compressor and limiter. When it sounds right, <b>Export</b> a WAV — or MIDI for your DAW.
            </Step>
          </ol>

          <div className="flex flex-col gap-s4">
            <div className="flex items-baseline gap-s3">
              <Note />
              <Hand as="h2" className="text-[30px] leading-none text-ink">Know your controls</Hand>
              <Hand className="text-[16px] text-ink-soft">— they’re all live, go on, touch them</Hand>
            </div>
            <Controls />
          </div>

          <div className="guide-sticky flex flex-wrap items-center gap-x-s5 gap-y-s2 self-start rounded-md p-s4">
            <Hand className="text-[22px] text-ink">Handy keys</Hand>
            {[['Space', 'play / stop'], ['Enter', 'back to start'], ['B / S', 'beat / song'], ['M', 'mixer'], ['T', 'tap tempo'], ['Ctrl+Z', 'undo'], ['?', 'all shortcuts']].map(([k, v]) => (
              <span key={k} className="flex items-center gap-s2 text-[12px]"><Kbd>{k}</Kbd><span className="text-ink-soft">{v}</span></span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
