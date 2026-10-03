import { useUi } from '../../store/ui';

// docs/PRD.md F8. Mixer drawer lands in T9.
export default function Mixer() {
  return (
    <section aria-label="Mixer" className="panel slide-up fixed bottom-0 left-s3 right-s3 z-30 h-[260px] p-s4">
      <div className="flex justify-between">
        <h2 className="label text-ink">Mixer</h2>
        <button className="btn" onClick={() => useUi.getState().set({ mixerOpen: false })}>Close</button>
      </div>
    </section>
  );
}
