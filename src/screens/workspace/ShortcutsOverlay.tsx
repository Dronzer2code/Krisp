import { useUi } from '../../store/ui';
import { Dialog } from '../../ui/Dialog';

// docs/PRD.md F12. "?" shows all keyboard shortcuts.

const ROWS: [string, string][] = [
  ['Space', 'Play / Stop'],
  ['Enter', 'Return to start'],
  ['L', 'Loop on/off'],
  ['B / S', 'Play mode BEAT / SONG'],
  ['M', 'Mixer drawer'],
  ['T', 'Tap tempo'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z', 'Redo'],
  ['Delete / Backspace', 'Delete selected clip'],
  ['Ctrl/⌘ + D', 'Duplicate selected clip'],
  ['Shift + click', 'Cycle pad velocity'],
  ['Arrows · Space', 'Move in the grid · toggle pad'],
  ['A S D F G H J K', 'Live record Slots 1–8 (Record on)'],
  ['?', 'This overlay'],
];

export function ShortcutsOverlay() {
  const open = useUi((s) => s.shortcutsOpen);
  const close = () => useUi.getState().set({ shortcutsOpen: false });
  return (
    <Dialog open={open} title="Keyboard shortcuts" onClose={close} actions={<button className="btn" data-autofocus onClick={close}>Close</button>}>
      <table className="w-full">
        <tbody>
          {ROWS.map(([k, v]) => (
            <tr key={k} className="border-b border-panel-sunken last:border-0">
              <td className="py-s2 pr-s4"><kbd className="lcd lcd-sm inline-flex h-6 items-center px-s2 text-[12px]">{k}</kbd></td>
              <td className="py-s2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
