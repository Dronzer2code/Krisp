import { create } from 'zustand';
import type { Id } from '../model/types';

// Screen state that is not part of the Workspace (not saved, not undoable).

export type SidePanel = 'SOUNDS' | 'AI';
export type SoundsTab = 'presets' | 'create' | 'upload' | 'library';
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface UiState {
  mixerOpen: boolean;
  sidePanel: SidePanel;
  /** Slide-over open state for narrow layouts. */
  sideOpen: boolean;
  rackOpen: boolean;
  soundsTab: SoundsTab;
  /** When set, "Use" in the Sound Browser assigns to this Slot (Replace sound). */
  replaceSlotId: Id | null;
  selectedClipId: Id | null;
  shortcutsOpen: boolean;
  exportOpen: boolean;
  record: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  announcement: string;
  toasts: Toast[];
  set: (patch: Partial<Omit<UiState, 'set' | 'announce' | 'toast' | 'dismissToast'>>) => void;
  announce: (text: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  mixerOpen: false,
  sidePanel: 'SOUNDS',
  sideOpen: false,
  rackOpen: false,
  soundsTab: 'presets',
  replaceSlotId: null,
  selectedClipId: null,
  shortcutsOpen: false,
  exportOpen: false,
  record: false,
  saveStatus: 'saved',
  saveError: null,
  announcement: '',
  toasts: [],
  set: (patch) => set(patch),
  announce: (text) => set({ announcement: text + '​'.repeat(toastId++ % 2) }), // vary to re-announce repeats
  toast: (text, tone = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const ui = () => useUi.getState();
