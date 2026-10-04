import { memo, useEffect, useRef, useState } from 'react';
import { getBuffer, useBufferVersion } from '../../audio/buffers';
import { peaks } from '../../audio/analyze';
import type { SoundMeta } from '../../api/sounds';
import { useUi } from '../../store/ui';
import { useWorkspace } from '../../store/workspace';
import { PlayIcon } from '../../ui/icons';
import { LedButton } from '../../ui/LedButton';
import { Menu } from '../../ui/Menu';
import { SOUND_DRAG_TYPE, type SoundDragPayload } from './dnd';
import { addAsNewSlot, assignToSlot, placeOnAudioLane, previewSound } from './soundActions';

// docs/UI_DESIGN.md → Side panel Sounds rows (48 px): preview, name, kind/source badges, duration,
// waveform thumbnail (64×24 canvas; narrower than the spec's 80 so badges fit the 320 px panel), Use. Rows drag onto AUDIO lanes.

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
    c.width = 64 * dpr;
    c.height = 24 * dpr;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, 64, 24);
    g.fillStyle = buf ? '#2F3033' : '#BDB7AC';
    const pts = buf ? peaks(buf, 32) : Array.from({ length: 32 }, () => 0.08);
    pts.forEach((p, i) => {
      const h = Math.max(1, p * 22);
      g.fillRect(i * 2, 12 - h / 2, 1.2, h);
    });
  }, [buf]);
  return <canvas ref={ref} aria-hidden="true" style={{ width: 64, height: 24 }} className="shrink-0" />;
}

export function Badge({ children, tone = 'plain' }: { children: string; tone?: 'plain' | 'accent' }) {
  return (
    <span className="rounded-[4px] px-[5px] py-[2px] text-[9px] font-semibold uppercase tracking-[.06em]" style={tone === 'accent' ? { background: 'var(--led-on)', color: '#fff' } : { background: 'var(--panel-sunken)', color: 'var(--ink-soft)' }}>
      {children}
    </span>
  );
}

export const SoundRow = memo(function SoundRow({ sound, badges }: { sound: SoundMeta; badges?: { vector: boolean; keyword: boolean } }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const replaceSlotId = useUi((s) => s.replaceSlotId);
  const rack = useWorkspace((s) => s.workspace.rack);
  const usable = { id: sound.id, name: sound.name, kind: sound.kind, durationMs: sound.duration_ms };

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
          <span className="font-display text-[10px] text-ink-soft">{(sound.duration_ms / 1000).toFixed(1)}s</span>
        </div>
      </div>
      <Thumb id={sound.id} kind={sound.kind} />
      <button className="btn h-7 px-s3" aria-haspopup={sound.kind === 'ONE_SHOT' && !replaceSlotId ? 'menu' : undefined} onClick={(e) => use(e.currentTarget)}>Use</button>
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
    </li>
  );
});
