import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { embed, getEmbedStatus, soundEmbeddingText, subscribeEmbedStatus } from '../../ai/embed';
import { canonicalMime, decode, durationMs, guessMime, suggestKind, validateUpload, type SoundKind } from '../../audio/analyze';
import { loadBuffer, putBuffer } from '../../audio/buffers';
import { ApiError } from '../../api/client';
import {
  generateSound, listSounds, remainingGenerations, searchSounds, shapePrompt, suggestNameAndTags, toBase64, uploadSound,
  type SearchResult, type SoundMeta,
} from '../../api/sounds';
import { KIT, KIT_ORDER } from '../../presets/kit';
import { useUi, type SoundsTab } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { Knob } from '../../ui/Knob';
import { Led, LedButton } from '../../ui/LedButton';
import { Menu } from '../../ui/Menu';
import { PlayIcon, SearchIcon, SparkleIcon, UploadIcon } from '../../ui/icons';
import { Tabs } from '../../ui/Tabs';
import { Toggle } from '../../ui/Toggle';
import { assignPresetToSlot, previewPreset } from './soundActions';
import { Badge, SoundRow } from './SoundRow';

// docs/PRD.md F6/F7; docs/PROCESS_FLOW.md J4–J6, SF2–SF4; docs/UI_DESIGN.md → Side panel Sounds.

// ── Library cache shared by the tabs ──
let library: SoundMeta[] | null = null;
let libraryError = false;
const libListeners = new Set<() => void>();
const emitLib = () => libListeners.forEach((cb) => cb());
async function refreshLibrary() {
  try {
    library = await listSounds(undefined, 200);
    libraryError = false;
  } catch {
    libraryError = true;
  }
  emitLib();
}
function addToLibrary(s: SoundMeta) {
  library = [s, ...(library ?? []).filter((x) => x.id !== s.id)];
  emitLib();
}
function useLibrary() {
  const subscribe = useCallback((cb: () => void) => {
    libListeners.add(cb);
    return () => libListeners.delete(cb);
  }, []);
  return useSyncExternalStore(subscribe, () => library);
}

function useEmbedStatus() {
  return useSyncExternalStore(subscribeEmbedStatus, getEmbedStatus);
}

const STATUS_LED = { NotLoaded: '#BDB7AC', Loading: 'var(--led-amber)', Ready: 'var(--led-green)', Failed: 'var(--led-red)' } as const;

function ModelLed() {
  const st = useEmbedStatus();
  const text = { NotLoaded: 'Search model loads on first use', Loading: 'Loading search model…', Ready: 'Search model ready (runs in your browser)', Failed: 'Search model failed to load' }[st];
  return (
    <span className="flex items-center gap-s2" title={text}>
      <Led color={STATUS_LED[st]} on={st !== 'NotLoaded'} label={text} />
      <span className="label">{st === 'Loading' ? 'loading model' : 'all-MiniLM'}</span>
    </span>
  );
}

// ── Presets tab ──
function PresetsTab() {
  const replaceSlotId = useUi((s) => s.replaceSlotId);
  const rack = useWorkspace((s) => s.workspace.rack);
  const [menu, setMenu] = useState<{ preset: (typeof KIT_ORDER)[number]; anchor: HTMLElement } | null>(null);
  return (
    <ul className="flex flex-col">
      {KIT_ORDER.map((p) => (
        <li key={p} className="flex min-h-12 items-center gap-s2 rounded-sm px-s1 hover:bg-panel-sunken">
          <LedButton label={`Preview ${KIT[p].label} preset`} toggle={false} led={false} size={28} onClick={() => void previewPreset(p)}><PlayIcon size={12} /></LedButton>
          <span className="flex-1 text-[12px] font-semibold">{KIT[p].label}</span>
          <Badge>synth</Badge>
          <button
            className="btn h-7 px-s3"
            onClick={(e) => {
              if (replaceSlotId) {
                assignPresetToSlot(replaceSlotId, p);
                useUi.getState().set({ replaceSlotId: null });
              } else setMenu({ preset: p, anchor: e.currentTarget });
            }}
          >
            Use
          </button>
        </li>
      ))}
      <Menu
        anchor={menu?.anchor ?? null}
        label="Assign preset"
        onClose={() => setMenu(null)}
        items={menu ? rack.map((slot) => ({ label: `Assign to ${slot.name}`, onSelect: () => assignPresetToSlot(slot.id, menu.preset) })) : []}
      />
    </ul>
  );
}

// ── Create tab (ElevenLabs) ──
type GenState = 'Idle' | 'Embedding' | 'Requesting' | 'Preparing' | 'Ready' | 'Failed';

function CreateTab() {
  const bpm = useWorkspace((s) => s.workspace.bpm);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<SoundKind>('ONE_SHOT');
  const [seconds, setSeconds] = useState(1);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<GenState>('Idle');
  const [message, setMessage] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [results, setResults] = useState<SoundMeta[]>([]);

  useEffect(() => {
    remainingGenerations().then((r) => setRemaining(r.remainingToday)).catch(() => {});
  }, []);

  useEffect(() => {
    if (touched) return;
    const s = suggestNameAndTags(text);
    setName(text.trim() ? s.name : '');
    setTags(s.tags.join(', '));
  }, [text, touched]);

  useEffect(() => {
    setSeconds(kind === 'ONE_SHOT' ? 1 : Math.min(30, Math.round(((60 / bpm) * 4 * 2) * 10) / 10)); // loops default to 2 bars
  }, [kind, bpm]);

  const prompt = text.trim() ? shapePrompt(text, kind, bpm) : '';
  const limitHit = remaining !== null && remaining <= 0;
  const busy = state === 'Embedding' || state === 'Requesting' || state === 'Preparing';

  const generate = async () => {
    if (text.trim().length < 3 || busy || limitHit) return;
    setMessage(null);
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    const finalName = name.trim() || suggestNameAndTags(text).name;
    try {
      setState('Embedding');
      const embedding = await embed(soundEmbeddingText(finalName, prompt, tagList));
      setState('Requesting');
      const res = await generateSound({ prompt, kind, durationSeconds: seconds, name: finalName, tags: tagList, embedding });
      setRemaining(res.remainingToday);
      setState('Preparing');
      await loadBuffer(res.sound.id, res.sound.kind);
      addToLibrary(res.sound);
      setResults((r) => [res.sound, ...r]);
      setState('Ready');
      useUi.getState().announce(`Sound generated: ${res.sound.name}`);
    } catch (err) {
      setState('Failed');
      if (err instanceof ApiError && err.code === 'daily_limit') {
        setRemaining(0);
        setMessage('You’ve used today’s sound generations. Presets and uploads still work.');
      } else if (err instanceof ApiError && err.code === 'elevenlabs_error') setMessage(`ElevenLabs could not make that sound. ${err.detail ?? ''}`.trim());
      else if (err instanceof ApiError && err.status === 401) setMessage('Enter the studio passcode to generate sounds.');
      else setMessage('Network problem — try again.');
    }
  };

  return (
    <form className="flex flex-col gap-s3" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
      <label className="label" htmlFor="create-text">Describe the sound</label>
      <textarea
        id="create-text"
        className="field no-scrollbar h-[72px] resize-none py-s2"
        placeholder="Describe the sound — e.g. ‘dusty vinyl kick, warm, short tail’."
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-s4">
        <Toggle label="Sound kind" left="One-shot" right="Loop" value={kind === 'ONE_SHOT' ? 'One-shot' : 'Loop'} onChange={(v) => setKind(v === 'Loop' ? 'LOOP' : 'ONE_SHOT')} />
        <Knob label="Length" size="sm" value={seconds} min={kind === 'ONE_SHOT' ? 0.5 : 1} max={kind === 'ONE_SHOT' ? 2 : 30} step={kind === 'ONE_SHOT' ? 0.1 : 0.5}
          format={(v) => `${v.toFixed(1)} s`} onChange={setSeconds} />
        <span className="font-display text-[12px]">{seconds.toFixed(1)} s</span>
      </div>
      <div className="grid grid-cols-2 gap-s2">
        <div>
          <label className="label mb-s1 block" htmlFor="create-name">Name</label>
          <input id="create-name" className="field" value={name} maxLength={100} onChange={(e) => { setTouched(true); setName(e.target.value); }} />
        </div>
        <div>
          <label className="label mb-s1 block" htmlFor="create-tags">Tags</label>
          <input id="create-tags" className="field" value={tags} onChange={(e) => { setTouched(true); setTags(e.target.value); }} />
        </div>
      </div>
      {prompt && <p className="text-[11px] text-ink-soft"><span className="label">Sent to ElevenLabs:</span> {prompt}</p>}
      <div className="flex items-center gap-s3">
        <button className="btn btn-primary" type="submit" disabled={busy || limitHit || text.trim().length < 3}>
          <Led color={busy ? 'var(--led-amber)' : state === 'Failed' ? 'var(--led-red)' : 'var(--led-green)'} on={busy || state === 'Failed' || state === 'Ready'} size={6} />
          <SparkleIcon /> {busy ? `${state}…` : 'Generate'}
        </button>
        {remaining !== null && <span className="label">{remaining} left today</span>}
        <span className="ml-auto"><ModelLed /></span>
      </div>
      {(message || limitHit) && <p role="alert" className="text-[12px] text-[#B3261E]">{message ?? 'You’ve used today’s sound generations. Presets and uploads still work.'}</p>}
      {results.length > 0 && (
        <ul className="flex flex-col border-t border-panel-sunken pt-s2" aria-label="Generated sounds">
          {results.map((s) => <SoundRow key={s.id} sound={s} />)}
        </ul>
      )}
    </form>
  );
}

// ── Upload tab ──
interface UploadItem {
  key: string;
  file: File;
  state: 'Decoding' | 'Invalid' | 'Ready' | 'Uploading' | 'Saved' | 'Failed';
  error?: string;
  name: string;
  kind: SoundKind;
  tags: string;
  durationMs: number;
  decoded?: AudioBuffer;
  sound?: SoundMeta;
}

function UploadTab() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const patch = (key: string, p: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const add = async (files: FileList | File[]) => {
    for (const file of [...files]) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 60) || 'Upload';
      const invalid = validateUpload(file);
      setItems((xs) => [...xs, { key, file, state: invalid ? 'Invalid' : 'Decoding', error: invalid ?? undefined, name: base, kind: 'ONE_SHOT', tags: '', durationMs: 0 }]);
      if (invalid) continue;
      try {
        const decoded = await decode(await file.arrayBuffer());
        const ms = durationMs(decoded);
        patch(key, { state: 'Ready', decoded, durationMs: ms, kind: suggestKind(ms) });
      } catch {
        patch(key, { state: 'Invalid', error: 'Could not decode this file.' });
      }
    }
  };

  const save = async (it: UploadItem) => {
    if (!it.decoded) return;
    patch(it.key, { state: 'Uploading', error: undefined });
    try {
      const tagList = it.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const mime = canonicalMime(it.file.type || guessMime(it.file.name))!;
      const embedding = await embed(soundEmbeddingText(it.name, null, tagList));
      const sound = await uploadSound({ name: it.name, kind: it.kind, tags: tagList, mime, durationMs: it.durationMs, audioBase64: toBase64(await it.file.arrayBuffer()), embedding });
      putBuffer(sound.id, sound.kind, it.decoded); // SF3: no re-download
      addToLibrary(sound);
      patch(it.key, { state: 'Saved', sound });
      useUi.getState().announce(`Saved ${sound.name} to the library`);
    } catch (err) {
      patch(it.key, { state: 'Failed', error: err instanceof ApiError && err.status === 401 ? 'Enter the studio passcode to upload.' : 'Upload failed — try again.' });
    }
  };

  return (
    <div className="flex flex-col gap-s3">
      <button
        type="button"
        className="flex h-24 flex-col items-center justify-center gap-s2 rounded-md border-2 border-dashed text-ink-soft"
        style={{ borderColor: over ? 'var(--led-on)' : '#BDB7AC', background: over ? 'var(--panel-sunken)' : undefined }}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
      >
        <UploadIcon size={20} />
        <span className="text-[12px]">Drop WAV / MP3 / OGG (≤ 3 MB) or click to choose</span>
      </button>
      <input ref={input} type="file" accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg" multiple hidden onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ''; }} />
      <ul className="flex flex-col gap-s2">
        {items.map((it) => (
          <li key={it.key} className="sunken flex flex-col gap-s2 p-s2">
            {it.sound ? (
              <ul><SoundRow sound={it.sound} /></ul>
            ) : (
              <>
                <div className="flex items-center gap-s2">
                  <input aria-label="Sound name" className="field h-7 flex-1" value={it.name} disabled={it.state !== 'Ready' && it.state !== 'Failed'} onChange={(e) => patch(it.key, { name: e.target.value })} />
                  <span className="font-display text-[11px]">{it.durationMs ? `${(it.durationMs / 1000).toFixed(1)}s` : ''}</span>
                </div>
                {it.state === 'Invalid' ? (
                  <p role="alert" className="text-[12px] text-[#B3261E]">{it.file.name}: {it.error}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-s2">
                    <Toggle label="Kind" left="One-shot" right="Loop" value={it.kind === 'ONE_SHOT' ? 'One-shot' : 'Loop'} onChange={(v) => patch(it.key, { kind: v === 'Loop' ? 'LOOP' : 'ONE_SHOT' })} />
                    <input aria-label="Tags" placeholder="tags, comma separated" className="field h-7 min-w-[120px] flex-1" value={it.tags} onChange={(e) => patch(it.key, { tags: e.target.value })} />
                    <button className="btn h-7 px-s3" disabled={it.state !== 'Ready' && it.state !== 'Failed'} onClick={() => void save(it)}>
                      {it.state === 'Uploading' ? 'Saving…' : it.state === 'Decoding' ? 'Reading…' : 'Save'}
                    </button>
                  </div>
                )}
                {it.state === 'Failed' && <p role="alert" className="text-[12px] text-[#B3261E]">{it.error}</p>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Library tab (hybrid search) ──
function LibraryTab() {
  const lib = useLibrary();
  const replaceSlotId = useUi((s) => s.replaceSlotId);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<SoundKind | 'ALL'>(replaceSlotId ? 'ONE_SHOT' : 'ALL');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (library === null) void refreshLibrary();
  }, []);
  // Kind filter follows context (J6): replacing a Slot sound → One-shot; back to All afterwards.
  useEffect(() => {
    setKind(replaceSlotId ? 'ONE_SHOT' : 'ALL');
  }, [replaceSlotId]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      seq.current++; // drop any search still in flight
      setResults(null);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    const t = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const embedding = await embed(term);
        const r = await searchSounds(term, embedding, kind === 'ALL' ? undefined : kind);
        if (id === seq.current) setResults(r);
      } catch {
        if (id === seq.current) setError('Search failed — check your connection.');
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, kind]);

  const shown = results ?? (lib ?? []).filter((s) => kind === 'ALL' || s.kind === kind);

  return (
    <div className="flex flex-col gap-s3">
      <div className="relative">
        <span className="pointer-events-none absolute left-s2 top-1/2 -translate-y-1/2 text-ink-soft"><SearchIcon /></span>
        <input aria-label="Search sounds" type="search" className="field" style={{ paddingLeft: 32 }} placeholder="Describe a sound — “warm dusty kick”, “808”" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex items-center gap-s2">
        <div role="radiogroup" aria-label="Kind filter" className="flex gap-s1">
          {(['ALL', 'ONE_SHOT', 'LOOP'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className="chip inline-flex h-6 items-center rounded-full px-s3 text-[11px]" data-selected={kind === k || undefined} onClick={() => setKind(k)}>
              {k === 'ALL' ? 'All' : k === 'ONE_SHOT' ? 'One-shot' : 'Loop'}
            </button>
          ))}
        </div>
        <span className="ml-auto"><ModelLed /></span>
      </div>
      {searching && <p className="label" role="status">Searching…</p>}
      {error && <p role="alert" className="text-[12px] text-[#B3261E]">{error}</p>}
      {libraryError && !results && <p role="alert" className="text-[12px] text-[#B3261E]">Could not load the library. <button className="underline" onClick={() => void refreshLibrary()}>Retry</button></p>}
      {lib !== null && shown.length === 0 && !searching && (
        <p className="text-ink-soft">{results ? 'No matches. Try other words.' : 'No sounds yet. Create one or upload your own.'}</p>
      )}
      <ul className="flex flex-col" aria-label={results ? 'Search results' : 'Library'}>
        {shown.map((s) => (
          <SoundRow key={s.id} sound={s} badges={results ? { vector: (s as SearchResult).vector_hit, keyword: (s as SearchResult).keyword_hit } : undefined} />
        ))}
      </ul>
    </div>
  );
}

export function SoundBrowser() {
  const tab = useUi((s) => s.soundsTab);
  const replaceSlotId = useUi((s) => s.replaceSlotId);
  const slot = useWorkspace((s) => s.workspace.rack.find((x) => x.id === replaceSlotId));
  const items: { value: SoundsTab; label: string }[] = [
    { value: 'presets', label: 'Presets' },
    { value: 'create', label: 'Create' },
    { value: 'upload', label: 'Upload' },
    { value: 'library', label: 'Library' },
  ];
  return (
    <div className="flex flex-col gap-s3">
      {slot && (
        <div className="flex items-center gap-s2 rounded-sm bg-panel-sunken px-s3 py-s2 text-[12px]" role="status">
          <span className="h-2 w-2 rounded-full" style={{ background: slot.color }} />
          <span>Replacing sound for <b>{slot.name}</b></span>
          <button className="ml-auto underline" onClick={() => useUi.getState().set({ replaceSlotId: null })}>Cancel</button>
        </div>
      )}
      <Tabs label="Sounds" idPrefix="sounds" value={tab} onChange={(v) => useUi.getState().set({ soundsTab: v })} items={items} />
      <div role="tabpanel" id={`sounds-panel-${tab}`} aria-labelledby={`sounds-tab-${tab}`}>
        {tab === 'presets' && <PresetsTab />}
        {tab === 'create' && <CreateTab />}
        {tab === 'upload' && <UploadTab />}
        {tab === 'library' && <LibraryTab />}
      </div>
    </div>
  );
}
