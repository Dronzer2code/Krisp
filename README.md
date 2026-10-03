# Pocket — a beat workspace that runs in the browser

Pocket is a calm, hardware-feel beat workspace built for one producer friend. Make beats by hand on a step
sequencer, arrange them into a song, mix them with channel strips and a master chain, and export WAV and MIDI for
your DAW. Open-source AI (Magenta.js) runs **in your browser** to humanize and vary your own beats. ElevenLabs
creates the exact one-shot or loop you describe, and a Tiger Data hybrid search finds any sound again by its
name or by its sound ("warm dusty kick").

Built for the DEV **Hacktoberfest Weekend Challenge: Build for a Friend** (October 2026).

- **Live demo:** _URL added after deploy_ (the sound library and saving are behind a studio passcode)
- **Docs for agents and contributors:** [`CLAUDE.md`](CLAUDE.md) → [`docs/`](docs/)

## What it does

| Area | Features |
|---|---|
| Workspaces | Create (empty or from 8 original preset beats), open, rename, duplicate, delete; autosave with a save LED |
| Transport | Play/stop, return to start, BEAT/SONG mode, BPM (drag, type, tap), swing, metronome, loop region, undo/redo |
| Rack | 8-slot synth kit, preview, rename, recolor, tune ±12, mute/solo, add/remove, replace sound from the library |
| Beat Editor | Click, drag-paint, Shift+click velocity (ghost/soft/normal/accent), 16/32 steps, clear, beat chips, live record (A–K) |
| Song | Beat lanes and audio lanes, drag beats and loops onto bars, move, resize (beats repeat), duplicate, delete |
| Sounds | Presets, **Create** with ElevenLabs, **Upload** your own, **Library** with hybrid (vector + keyword) search |
| Mixer | Channel strips (EQ, send, pan, fader, meter, M/S), reverb return, master EQ, compressor + GR LEDs, limiter |
| AI (open source, in-browser) | Humanize (GrooVAE), Variations (MusicVAE), Continue (DrumRNN), Morph (MusicVAE) — all undoable |
| Export | WAV mixdown (offline render through the same engine) and MIDI (GM drums) |

## Stack

Vite · React 18 · TypeScript · Tailwind · zustand · Tone.js · @magenta/music · @huggingface/transformers
(all-MiniLM-L6-v2) · @tonejs/midi · Vercel Functions · Tiger Data (Postgres + pgvector) · ElevenLabs Sound Effects.

## Run locally

```bash
cp .env.example .env      # TIGER_DATABASE_URL, ELEVENLABS_API_KEY, APP_PASSCODE, DAILY_SOUND_LIMIT
npm install
npx vercel link           # once
npx vercel dev            # app + /api on http://localhost:3000
npm run test              # vitest
npm run build && bash scripts/check-secrets.sh
```

Database: run [`db/schema.sql`](db/schema.sql) once in the Tiger Data SQL editor. Full steps: [`docs/SETUP.md`](docs/SETUP.md).

## Credits

Pocket stands on these open-source projects and models:

- [Magenta.js](https://github.com/magenta/magenta-js) (Apache-2.0) — MusicVAE, GrooVAE and DrumRNN checkpoints, trained on the open Groove MIDI Dataset
- [Tone.js](https://github.com/Tonejs/Tone.js) (MIT) — audio engine, transport and offline rendering
- [transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0) and
  [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) (Apache-2.0) — in-browser text embeddings
- [@tonejs/midi](https://github.com/Tonejs/Midi) (MIT) — MIDI export
- [pgvector](https://github.com/pgvector/pgvector) on Tiger Data — vector search

All preset beat patterns are original to this project.

## Commits after deadline

None yet. Any commit after 2026-10-05T06:59:00Z will be listed here with its purpose.
