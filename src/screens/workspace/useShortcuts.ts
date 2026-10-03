import { useEffect } from 'react';
import { currentStepPosition, previewSlot, restart, togglePlay } from '../../audio/context';
import { selectedBeat } from '../../store/selectors';
import { useUi } from '../../store/ui';
import { actions, useWorkspace } from '../../store/workspace';
import { tap } from './TransportBar';

// docs/UI_DESIGN.md → KEYBOARD SHORTCUTS. Single-key shortcuts are ignored while a text field is focused.
// Space / Enter act on the transport unless a control was focused by keyboard (then the control wins).

export function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'range', 'submit'].includes(el.type);
  return false;
}

function keyboardFocusedControl(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement) || el === document.body) return false;
  const interactive = el.matches('button, a[href], [role=button], [role=tab], [role=switch], [role=menuitem], [role=radio], summary');
  if (!interactive) return false;
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** SHOULD F4: keys A–K play Slots 1–8; while playing in BEAT mode the hit is written to the nearest step. */
function liveRecord(slotIndex: number) {
  const w = useWorkspace.getState().workspace;
  const slot = w.rack[slotIndex];
  if (!slot) return;
  void previewSlot(slot.id);
  const beat = selectedBeat(w);
  const pos = currentStepPosition();
  if (!beat || pos === null) return;
  if (w.playMode !== 'BEAT') {
    useUi.getState().toast('Live record writes in BEAT mode.');
    return;
  }
  const step = ((Math.round(pos) % beat.length) + beat.length) % beat.length;
  actions.setStep('push', beat.id, slot.id, step, { on: true, velocity: 100, offset: 0 });
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTextField(e.target)) return;
      if (document.querySelector('[role=dialog]')) return; // dialogs own the keyboard
      const ui = useUi.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        actions.redo();
        return;
      }
      if (mod && k === 'd') {
        if (ui.selectedClipId) {
          e.preventDefault();
          actions.duplicateClip(ui.selectedClipId);
        }
        return;
      }
      if (mod || e.altKey) return;

      if (e.key === ' ' || e.key === 'Enter') {
        if (keyboardFocusedControl(e.target)) return;
        e.preventDefault();
        if (e.key === ' ') void togglePlay();
        else void restart();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedClipId) {
        e.preventDefault();
        actions.removeClip(ui.selectedClipId);
        ui.set({ selectedClipId: null });
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        ui.set({ shortcutsOpen: true });
        return;
      }
      // Live record overrides single letters A–K (incl. S) while Record is on (docs/UI_DESIGN.md precedence).
      if (ui.record && k.length === 1 && 'asdfghjk'.includes(k)) {
        e.preventDefault();
        if (!e.repeat) liveRecord('asdfghjk'.indexOf(k));
        return;
      }
      switch (k) {
        case 'b':
          actions.setPlayMode('BEAT');
          break;
        case 's':
          actions.setPlayMode('SONG');
          break;
        case 'm':
          ui.set({ mixerOpen: !ui.mixerOpen });
          break;
        case 't':
          tap();
          break;
        case 'l': {
          const loop = useWorkspace.getState().workspace.loop;
          actions.setLoop({ enabled: !loop.enabled });
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
