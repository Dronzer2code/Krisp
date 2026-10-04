import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { embed, getEmbedStatus, soundEmbeddingText, subscribeEmbedStatus } from '../../ai/embed';
import { canonicalMime, decode, durationMs, guessMime, suggestKind, validateUpload, type SoundKind } from '../../audio/analyze';
import { loadBuffer, putBuffer } from '../../audio/buffers';
import { ApiError } from '../../api/client';
import {
  generateSound, remainingGenerations, searchSounds, shapePrompt, suggestNameAndTags, toBase64, uploadSound,
  type SearchResult, type SoundMeta,
} from '../../api/sounds';
import { KIT, KIT_ORDER } from '../../presets/kit';
import {
  addSoundToPlaylist, addToLibrary, createLibraryPlaylist, deleteLibraryPlaylist, openPlaylist, playlistSounds, refreshLibrary,
  renameLibraryPlaylist, unsortedSounds, useLibrary,
} from '../../store/library';
import type { Playlist } from '../../api/playlists';
import { useUi, type SoundsTab } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { Knob } from '../../ui/Knob';
import { Led, LedButton } from '../../ui/LedButton';
import { Menu } from '../../ui/Menu';
import { BackIcon, FolderIcon, MoreIcon, PlayIcon, PlusIcon, SearchIcon, SparkleIcon, UploadIcon } from '../../ui/icons';
import { Tabs } from '../../ui/Tabs';
import { Toggle } from '../../ui/Toggle';
import { assignPresetToSlot, previewPreset } from './soundActions';
import { SOUND_DRAG_TYPE, type SoundDragPayload } from './dnd';
import { ConfirmDialog, NameDialog } from './SoundDialogs';
import { Badge, SoundRow } from './SoundRow';

// docs/PRD.md F6/F7; docs/PROCESS_FLOW.md J4–J6, SF2–SF4; docs/UI_DESIGN.md → Side panel Sounds.

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

// ── Library tab: playlists (folders) + unsorted Sounds, hybrid search across everything ──

function FolderRow({ playlist, count, onOpen }: { playlist: Playlist; count: number; onOpen: () => void }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [dlg, setDlg] = useState<null | 'rename' | 'delete'>(null);
  const [over, setOver] = useState(false);
  return (
    <li
      className="flex min-h-11 items-center gap-s2 rounded-sm px-s1 hover:bg-panel-sunken"
      style={over ? { background: 'var(--panel-sunken)', outline: '2px dashed var(--led-on)', outlineOffset: -2 } : undefined}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(SOUND_DRAG_TYPE)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        try {
          const d = JSON.parse(e.dataTransfer.getData(SOUND_DRAG_TYPE)) as SoundDragPayload;
          const s = useLibrary.getState().sounds?.find((x) => x.id === d.id);
          if (s) void addSoundToPlaylist(s, playlist.id);
        } catch {
          /* not a sound */
        }
      }}
    >
      <button type="button" className="flex min-w-0 flex-1 items-center gap-s2 py-s2 text-left" onClick={onOpen} aria-label={`Open playlist ${playlist.name}, ${count} sounds`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-led-on shadow-raised" style={{ background: 'var(--panel-raised)' }}><FolderIcon /></span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{playlist.name}</span>
        <span className="font-display text-[11px] text-ink-soft">{count}</span>
      </button>
      <button className="icon-btn h-7 w-6 shrink-0" aria-label={`${playlist.name} options`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}><MoreIcon /></button>
      <Menu
        anchor={menu}
        label={`${playlist.name} options`}
        onClose={() => setMenu(null)}
        items={[
          { label: 'Open', onSelect: onOpen },
          { label: 'Rename', onSelect: () => setDlg('rename') },
          { label: 'Delete playlist', danger: true, onSelect: () => setDlg('delete') },
        ]}
      />
      <NameDialog open={dlg === 'rename'} title="Rename playlist" label="Playlist name" initial={playlist.name} submit="Rename"
        onSubmit={(n) => renameLibraryPlaylist(playlist, n)} onClose={() => setDlg(null)} />
      <ConfirmDialog open={dlg === 'delete'} title={`Delete “${playlist.name}”?`} confirm="Delete playlist"
        body="Only the playlist goes. Its sounds stay in your Library (unsorted if they are in no other playlist)."
        onConfirm={() => void deleteLibraryPlaylist(playlist)} onClose={() => setDlg(null)} />
    </li>
  );
}

function LibraryTab() {
  const lib = useLibrary((s) => s.sounds);
  const playlists = useLibrary((s) => s.playlists);
  const libraryError = useLibrary((s) => s.error);
  const openId = useLibrary((s) => s.openPlaylistId);
  const replaceSlotId = useUi((s) => s.replaceSlotId);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<SoundKind | 'ALL'>(replaceSlotId ? 'ONE_SHOT' : 'ALL');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (useLibrary.getState().sounds === null) void refreshLibrary();
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

  const byKind = <T extends { kind: SoundKind }>(xs: T[]) => xs.filter((s) => kind === 'ALL' || s.kind === kind);
  const open = playlists.find((p) => p.id === openId) ?? null;
  const all = lib ?? [];
  const inFolder = open ? byKind(playlistSounds(all, open)) : [];
  const unsorted = byKind(unsortedSounds(all, playlists));

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
      {libraryError && results === null && <p role="alert" className="text-[12px] text-[#B3261E]">Could not load the library. <button className="underline" onClick={() => void refreshLibrary()}>Retry</button></p>}

      {results !== null ? (
        <>
          {results.length === 0 && !searching && <p className="text-ink-soft">No matches. Try other words.</p>}
          <ul className="flex flex-col" aria-label="Search results">
            {results.map((s) => <SoundRow key={s.id} sound={s} badges={{ vector: s.vector_hit, keyword: s.keyword_hit }} />)}
          </ul>
        </>
      ) : open ? (
        <>
          <div className="flex items-center gap-s2">
            <button className="icon-btn h-7 w-7" aria-label="Back to Library" onClick={() => openPlaylist(null)}><BackIcon /></button>
            <span className="flex min-w-0 items-center gap-s2 text-[12px]">
              <button className="text-ink-soft hover:text-ink" onClick={() => openPlaylist(null)}>Library</button>
              <span className="text-ink-soft">/</span>
              <span className="shrink-0 text-led-on"><FolderIcon size={14} /></span>
              <b className="truncate">{open.name}</b>
            </span>
            <span className="ml-auto font-display text-[11px] text-ink-soft">{open.sound_ids.length}</span>
          </div>
          {inFolder.length === 0 && <p className="text-[12px] text-ink-soft">This playlist is empty. Use ⋯ → Add to playlist on any sound, or drag a sound onto the folder.</p>}
          <ul className="flex flex-col" aria-label={`Playlist ${open.name}`}>
            {inFolder.map((s) => <SoundRow key={s.id} sound={s} />)}
          </ul>
        </>
      ) : (
        <>
          <div className="flex items-center gap-s2">
            <span className="label text-ink">Playlists</span>
            <button className="btn ml-auto h-7 px-s2 text-[11px]" onClick={() => setCreating(true)}><PlusIcon size={12} /> New playlist</button>
          </div>
          {playlists.length === 0 ? (
            <p className="text-[12px] text-ink-soft">Group sounds into folders — “Kicks”, “Lo-fi loops”… Create one here or from any sound’s ⋯ menu.</p>
          ) : (
            <ul className="flex flex-col" aria-label="Playlists">
              {playlists.map((p) => (
                <FolderRow key={p.id} playlist={p} count={byKind(playlistSounds(all, p)).length} onOpen={() => openPlaylist(p.id)} />
              ))}
            </ul>
          )}
          <div className="mt-s1 flex items-center gap-s2 border-t border-panel-sunken pt-s3">
            <span className="label text-ink">Unsorted</span>
            <span className="font-display text-[11px] text-ink-soft">{unsorted.length}</span>
          </div>
          {lib !== null && all.length === 0 && <p className="text-ink-soft">No sounds yet. Create one or upload your own.</p>}
          {lib !== null && all.length > 0 && unsorted.length === 0 && <p className="text-[12px] text-ink-soft">Everything is in a playlist.</p>}
          <ul className="flex flex-col" aria-label="Unsorted sounds">
            {unsorted.map((s) => <SoundRow key={s.id} sound={s} />)}
          </ul>
        </>
      )}
      <NameDialog open={creating} title="New playlist" label="Playlist name" initial="" submit="Create"
        onSubmit={async (n) => { await createLibraryPlaylist(n); }} onClose={() => setCreating(false)} />
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
