import { useEffect, useState } from 'react';
import { getEngine, play, stop } from '../audio/context';
import { usePlayhead } from '../audio/playhead';
import { createWorkspace } from '../store/ops';
import { useWorkspace } from '../store/workspace';
import { Panel } from '../ui/Panel';

// Dev-only CP2 check: Boom Bap preset (swing 0.15, mixed velocities) through the full mixer graph.
// Route: /dev/audio. Reports the master meter so headless runs can confirm audio flows.

export default function AudioSmoke() {
  const step = usePlayhead((s) => s.beatStep);
  const playing = usePlayhead((s) => s.playing);
  const [report, setReport] = useState('');

  useEffect(() => {
    useWorkspace.getState().load(createWorkspace('Smoke', 'boom-bap'));
  }, []);

  async function run() {
    await play();
    const samples: number[] = [];
    const id = window.setInterval(() => {
      const m = getEngine()?.meters().master ?? -Infinity;
      samples.push(m);
      if (samples.length === 20) {
        window.clearInterval(id);
        stop();
        const finite = samples.filter((v) => Number.isFinite(v));
        setReport(JSON.stringify({ ok: finite.length > 0, maxDb: Math.max(...finite.map((v) => Math.round(v))), samples: samples.length, finite: finite.length }));
      }
    }, 100);
  }

  return (
    <main className="p-s5">
      <Panel label="Audio smoke test" className="p-s5">
        <p className="label mb-s3">Audio smoke test (dev only)</p>
        <button id="run" className="rounded-sm bg-panel-raised px-s3 py-s2 shadow-raised" onClick={run}>Play 2 s</button>
        <p className="mt-s3 font-display">playing {String(playing)} · step {step}</p>
        <pre id="result" className="mt-s3 font-display text-[12px]">{report}</pre>
      </Panel>
    </main>
  );
}
