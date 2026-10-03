import { Panel } from '../../ui/Panel';

// docs/PRD.md F5. Timeline lands in T7.
export function Song() {
  return (
    <Panel label="Song" className="p-s4">
      <h2 className="label text-ink">Song</h2>
      <p className="mt-s2 text-ink-soft">Drag a beat here to start your tune.</p>
    </Panel>
  );
}
