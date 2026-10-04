import { create } from 'zustand';

// Panel sizes the user sets with the Splitters (docs/UI_DESIGN.md → Workspace → Resizable panels).
// A per-viewer convenience: kept in this browser's localStorage, never in the Workspace.

export interface LayoutSizes {
  /** Rack column width (≥ 1200 px layout). */
  rackW: number;
  /** Side panel width (≥ 1200 px layout). */
  sideW: number;
  /** Song lanes viewport height; null = fit all lanes. */
  songH: number | null;
  /** Mixer drawer height. */
  mixerH: number;
}

export const LAYOUT_DEFAULTS: LayoutSizes = { rackW: 304, sideW: 320, songH: null, mixerH: 440 };

export const LAYOUT_LIMITS = {
  rackW: { min: 288, max: 560 },
  sideW: { min: 320, max: 600 }, // narrower clips the Sounds tabs
  songH: { min: 140, max: 1200 },
  /** Below this the channel strips cannot fit EQ, send, pan, a usable fader and M/S. */
  mixerH: { min: 400, max: 900 },
} as const;

const KEY = 'pocket.layout';

const clamp = (v: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v)));

export function clampLayout(s: Partial<LayoutSizes>): LayoutSizes {
  const d = LAYOUT_DEFAULTS;
  const L = LAYOUT_LIMITS;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    rackW: clamp(num(s.rackW, d.rackW), L.rackW.min, L.rackW.max),
    sideW: clamp(num(s.sideW, d.sideW), L.sideW.min, L.sideW.max),
    songH: s.songH === null || s.songH === undefined || !Number.isFinite(s.songH) ? null : clamp(s.songH, L.songH.min, L.songH.max),
    mixerH: clamp(num(s.mixerH, d.mixerH), L.mixerH.min, L.mixerH.max),
  };
}

function read(): LayoutSizes {
  try {
    const raw = localStorage.getItem(KEY);
    return clampLayout(raw ? (JSON.parse(raw) as Partial<LayoutSizes>) : {});
  } catch {
    return { ...LAYOUT_DEFAULTS };
  }
}

interface LayoutState extends LayoutSizes {
  setSize: (patch: Partial<LayoutSizes>) => void;
}

export const useLayout = create<LayoutState>()((set, get) => ({
  ...read(),
  setSize: (patch) => {
    const { rackW, sideW, songH, mixerH } = get();
    const next = clampLayout({ rackW, sideW, songH, mixerH, ...patch });
    set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: sizes last for this page only */
    }
  },
}));
