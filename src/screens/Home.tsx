import { Panel } from '../ui/Panel';

// Placeholder for T0. Full Home (cartridges, New workspace dialog) lands in T6.
export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-s5">
      <Panel label="Pocket" screws className="px-s6 py-s5">
        <h1 className="font-display text-[32px] font-medium tracking-[.12em] text-ink">POCKET</h1>
        <p className="label mt-s2">beat workspace</p>
      </Panel>
    </main>
  );
}
