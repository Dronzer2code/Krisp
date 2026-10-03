import { useEffect, useState } from 'react';
import { getModel, loadMagenta } from '../ai/magenta';
import { Panel } from '../ui/Panel';

// Dev-only smoke test for T1 (VERIFY-1, VERIFY-2). Route: /dev/magenta.
// Loads each checkpoint, runs the calls the AI tools rely on, and prints a JSON report.

const STEPS_PER_QUARTER = 4;

function testBeat() {
  // Kick on 1/9, snare on 5/13, hats on every 8th — 2 bars, quantized.
  const notes: { pitch: number; quantizedStartStep: number; quantizedEndStep: number; velocity: number; isDrum: boolean }[] = [];
  for (let s = 0; s < 32; s++) {
    const i = s % 16;
    if (i === 0 || i === 8) notes.push({ pitch: 36, quantizedStartStep: s, quantizedEndStep: s + 1, velocity: 100, isDrum: true });
    if (i === 4 || i === 12) notes.push({ pitch: 38, quantizedStartStep: s, quantizedEndStep: s + 1, velocity: 100, isDrum: true });
    if (i % 2 === 0) notes.push({ pitch: 42, quantizedStartStep: s, quantizedEndStep: s + 1, velocity: 80, isDrum: true });
  }
  return { notes, quantizationInfo: { stepsPerQuarter: STEPS_PER_QUARTER }, totalQuantizedSteps: 32, tempos: [{ time: 0, qpm: 90 }] };
}

type NS = { notes?: { pitch?: number | null; quantizedStartStep?: number | null; startTime?: number | null; velocity?: number | null }[] | null };
const brief = (ns: NS) => ({
  notes: ns.notes?.length ?? 0,
  first: (ns.notes ?? []).slice(0, 3).map((n) => ({ p: n.pitch, q: n.quantizedStartStep, t: n.startTime, v: n.velocity })),
});

async function run() {
  const report: Record<string, unknown> = {};
  const t0 = performance.now();
  const lib = await loadMagenta();
  report.source = lib.source;
  const seed = testBeat();

  const vae = await getModel('vae');
  report.vaeLoadMs = Math.round(performance.now() - t0);
  const samples = await vae.sample(1);
  report.sample = brief(samples[0]);
  const similar = await vae.similar(seed, 4, 0.7, 0.5);
  report.similar = similar.map(brief);
  const morph = await vae.interpolate([seed, samples[0]], 3);
  report.interpolate = morph.map(brief);

  const groove = await getModel('groove');
  const z = await groove.encode([seed]);
  const humanized = await groove.decode(z, undefined, undefined, STEPS_PER_QUARTER, 90);
  z.dispose();
  report.humanize = brief(humanized[0]);

  const rnn = await getModel('rnn');
  const bar1 = { ...seed, notes: seed.notes.filter((n) => n.quantizedStartStep < 16), totalQuantizedSteps: 16 };
  const cont = await rnn.continueSequence(bar1, 16, 1.0);
  report.continue = brief(cont);

  report.totalMs = Math.round(performance.now() - t0);
  return report;
}

export default function MagentaSmoke() {
  const [out, setOut] = useState('running…');
  useEffect(() => {
    run()
      .then((r) => setOut(JSON.stringify({ ok: true, ...r }, null, 1)))
      .catch((e: unknown) => setOut(JSON.stringify({ ok: false, error: String(e) })));
  }, []);
  return (
    <main className="p-s5">
      <Panel label="Magenta smoke test" className="p-s5">
        <p className="label mb-s3">Magenta smoke test (dev only)</p>
        <pre id="result" className="whitespace-pre-wrap font-display text-[12px]">{out}</pre>
      </Panel>
    </main>
  );
}
