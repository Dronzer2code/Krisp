import { useUi } from '../../store/ui';
import { Dialog } from '../../ui/Dialog';

// docs/PRD.md F10. Export lands in T11.
export default function ExportDialog() {
  const close = () => useUi.getState().set({ exportOpen: false });
  return (
    <Dialog open title="Export" onClose={close} actions={<button className="btn" onClick={close}>Close</button>}>
      <p>WAV and MIDI export.</p>
    </Dialog>
  );
}
