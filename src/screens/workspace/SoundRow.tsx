import { memo, useEffect, useRef, useState } from 'react';
import { getBuffer, useBufferVersion } from '../../audio/buffers';
import { peaks } from '../../audio/analyze';
import type { SoundMeta } from '../../api/sounds';
import {
  addSoundToPlaylist, copyLibrarySound, deleteLibrarySound, moveSoundToPlaylist, newPlaylistWith, removeSoundFromPlaylist,
  renameLibrarySound, useLibrary,
} from '../../store/library';
import { useUi } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { MoreIcon, PlayIcon } from '../../ui/icons';
import { LedButton } from '../../ui/LedButton';
import { Menu, type MenuItem } from '../../ui/Menu';
import { ConfirmDialog, NameDialog } from './SoundDialogs';
import { SOUND_DRAG_TYPE, type SoundDragPayload } from './dnd';
import { addAsNewSlot, assignToSlot, placeOnAudioLane, previewSound } from './soundActions';

// docs/UI_DESIGN.md → Side panel Sounds rows (48 px): preview, name, kind/source badges, duration,
// waveform thumbnail (48×16 on the badge line, so the name keeps the full row width next to Use and ⋯), Use. Rows drag onto AUDIO lanes.

function Thumb({ id, kind }: { id: string; kind: SoundMeta['kind'] }) {
  useBufferVersion();
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = getBuffer(id, kind);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = 48 * dpr;
    c.height = 16 * dpr;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, 48, 16);
    g.fillStyle = buf ? '#2F3033' : '#BDB7AC';
    const pts = buf ? peaks(buf, 24) : Array.from({ length: 24 }, () => 0.1);
    pts.forEach((p, i) => {
      const h = Math.max(1, p * 15);
      g.fillRect(i * 2, 8 - h / 2, 1.2, h);
    });
  }, [buf]);
  return <canvas ref={ref} aria-hidden="true" style={{ width: 48, height: 16 }} className="shrink-0" />;
}

export function Badge({ children, tone = 'plain' }: { children: string; tone?: 'plain' | 'accent' }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-[4px] px-[5px] py-[2px] text-[9px] font-semibold uppercase tracking-[.06em]" style={tone === 'accent' ? { background: 'var(--led-on)', color: '#fff' } : { background: 'var(--panel-sunken)', color: 'var(--ink-soft)' }}>
      {children}
    </span>
  );
}

type Dlg = null | 'rename' | 'delete' | 'new-add' | 'new-move';

export const SoundRow = memo(function SoundRow({ sound, badges }: { sound: SoundMeta; badges?: { vector: boolean; keyword: boolean } }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [more, setMore] = useState<HTMLElement | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  const playlists = useLibrary((s) => s.playlists);
  const openId = useLibrary((s) => s.openPlaylistId);
  const openPl = playlists.find((p) => p.id === openId);
  const replaceSlotId = useUi((s) => s.replaceSlotId);
  const rack = useWorkspace((s) => s.workspace.rack);
  const usable = { id: sound.id, name: sound.name, kind: sound.kind, durationMs: sound.duration_ms };


  const addItems: MenuItem[] = [
    ...playlists.map((p) => {
      const has = p.sound_ids.includes(sound.id);
      return { label: has ? `✓ ${p.name}` : p.name, disabled: has, onSelect: () => void addSoundToPlaylist(sound, p.id) };
    }),
    { label: '+ New playlist…', onSelect: () => setDlg('new-add') },
  ];
  const moveItems: MenuItem[] = [
    ...playlists.filter((p) => p.id !== openId).map((p) => ({ label: p.name, onSelect: () => void moveSoundToPlaylist(sound, openId, p.id) })),
    { label: '+ New playlist…', onSelect: () => setDlg('new-move') },
  ];

  const use = (anchor: HTMLElement) => {
    if (replaceSlotId) {
      assignToSlot(replaceSlotId, usable);
      useUi.getState().set({ replaceSlotId: null });
      return;
    }
    if (sound.kind === 'LOOP') placeOnAudioLane(usable);
    else setMenu(anchor);
  };

  return (
    <li
      className="flex min-h-12 items-center gap-s2 rounded-sm px-s1 py-s1 hover:bg-panel-sunken"
      draggable
      onDragStart={(e) => {
        const payload: SoundDragPayload = { id: sound.id, name: sound.name, kind: sound.kind, durationMs: sound.duration_ms };
        e.dataTransfer.setData(SOUND_DRAG_TYPE, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <LedButton label={`Preview ${sound.name}`} toggle={false} led={false} size={28} onClick={() => void previewSound(usable)}><PlayIcon size={12} /></LedButton>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold" title={sound.prompt ?? sound.name}>{sound.name}</div>
        <div className="mt-[3px] flex items-center gap-[3px] overflow-hidden">
          <Badge>{sound.kind === 'ONE_SHOT' ? 'one-shot' : 'loop'}</Badge>
          <Badge>{sound.source === 'ELEVENLABS' ? 'generated' : 'upload'}</Badge>
          {badges?.vector && <Badge tone="accent">vector</Badge>}
          {badges?.keyword && <Badge tone="accent">keyword</Badge>}
          <span className="shrink-0 font-display text-[10px] text-ink-soft">{(sound.duration_ms / 1000).toFixed(1)}s</span>
          <span className="ml-auto min-w-0 overflow-hidden"><Thumb id={sound.id} kind={sound.kind} /></span>
        </div>
      </div>
      <button className="btn h-7 px-s3" aria-haspopup={sound.kind === 'ONE_SHOT' && !replaceSlotId ? 'menu' : undefined} onClick={(e) => use(e.currentTarget)}>Use</button>
      <button className="icon-btn h-7 w-6 shrink-0" aria-label={`${sound.name} options`} aria-haspopup="menu" onClick={(e) => setMore(e.currentTarget)}><MoreIcon /></button>
      <Menu
        anchor={menu}
        label={`Use ${sound.name}`}
        onClose={() => setMenu(null)}
        items={[
          ...rack.map((slot) => ({ label: `Assign to ${slot.name}`, onSelect: () => assignToSlot(slot.id, usable) })),
          { label: 'Add as new slot', onSelect: () => addAsNewSlot(usable) },
          { label: 'Place on Audio lane', onSelect: () => placeOnAudioLane(usable) },
        ]}
      />
      <Menu
        anchor={more}
        label={`${sound.name} options`}
        onClose={() => setMore(null)}
        items={[
          { label: 'Rename', onSelect: () => setDlg('rename') },
          { label: 'Make a copy', onSelect: () => void copyLibrarySound(sound) },
          { label: 'Add to playlist', submenu: addItems },
          { label: 'Move to playlist', submenu: moveItems },
          ...(openPl ? [{ label: `Remove from “${openPl.name}”`, onSelect: () => void removeSoundFromPlaylist(sound, openPl.id) }] : []),
          { label: 'Delete', danger: true, onSelect: () => setDlg('delete') },
        ]}
      />
      <NameDialog open={dlg === 'rename'} title="Rename sound" label="Name" initial={sound.name} submit="Rename"
        onSubmit={(n) => renameLibrarySound(sound, n)} onClose={() => setDlg(null)} />
      <NameDialog open={dlg === 'new-add' || dlg === 'new-move'} title="New playlist" label="Playlist name" initial="" submit={dlg === 'new-move' ? 'Create and move' : 'Create and add'}
        onSubmit={(n) => newPlaylistWith(sound, n, dlg === 'new-move' ? 'move' : 'add')} onClose={() => setDlg(null)} />
      <ConfirmDialog open={dlg === 'delete'} title={`Delete “${sound.name}”?`} confirm="Delete sound"
        body="It is removed from the Library and every playlist. Slots or audio clips that use it will go silent."
        onConfirm={() => void deleteLibrarySound(sound)} onClose={() => setDlg(null)} />
    </li>
  );
});
