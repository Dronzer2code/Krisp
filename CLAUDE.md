# CLAUDE.md — Pocket

## PURPOSE

Entry point for any coding agent working on Pocket. Read this file first. It defines read order, working rules, commands and the definition of done.

## CONTEXT

- **Pocket** is a browser beat workspace with a minimal skeuomorphic (studio-hardware) UI. A producer creates Workspaces, builds Beats manually on a step sequencer with preset and custom sounds, arranges Beats and audio loops into a Song, mixes with channel strips and a master chain, uses open-source AI (Magenta.js, in the browser) to humanize and vary beats, generates sounds with ElevenLabs, uploads his own sounds, and exports WAV/MIDI.
- Built for the DEV "Hacktoberfest Weekend Challenge: Build for a Friend". Hard deadline **2026-10-05T06:59:00Z**. Code freeze target **2026-10-04T23:00:00Z**.
- Built for one real friend (a beat producer). Name: UNKNOWN.

## READ ORDER

1. `CLAUDE.md` (this file)
2. `AGENT.md` — rules for writing any `.md` in this repo
3. `docs/PRD.md` — what and why; feature IDs F1–F12; core concepts
4. `docs/MVP.md` — must/should/may scope, acceptance criteria, demo scenario, cut-line
5. `docs/TRD.md` — stack, data model, database, API, audio engine, AI, export
6. `docs/PROCESS_FLOW.md` — user journeys, system flows, state machines
7. `docs/UI_DESIGN.md` — design tokens, primitives, layouts, states
8. `docs/TASKS.md` — ordered tasks, owners, checkpoints
9. `docs/SETUP.md` — accounts, keys, local dev, deploy
10. `docs/SUBMISSION.md` — DEV post structure and evidence
11. `BUILD_PROMPTS.md` — prompts the humans paste, in order

These docs supersede any earlier `POCKET_SPEC.md`. If it exists, delete it in the first commit.

## REPOSITORY SOURCE

- The repository source is the **Entire repository `/et/krisp/krisp`**, git remote **`origin`** (`entire://aws-ap-south-1.entire.io/et/krisp/krisp`, managed with the Entire CLI).
- It is mirrored to **GitHub** at git remote **`github`** (`https://github.com/Dronzer2code/Krisp.git`). Vercel deploys from GitHub.
- After every commit MUST push to both: `git push origin main` and `git push github main`.
- First commit `23653fb` is dated 2026-10-03, inside the challenge window (starts 2026-10-02T02:00:00Z).

## WORKING RULES

- MUST use the concept names from `docs/PRD.md` → CORE CONCEPTS (Workspace, Rack, Slot, Beat, Song, Lane, Clip, Sound, Mixer, Channel, Master) in code, UI copy and commits.
- MUST NOT invent third-party API details. Items tagged `VERIFY` in `docs/TRD.md` → VERIFY REGISTER must be checked in official docs or the installed package first; record the result in the register in the same commit.
- MUST keep API keys inside `/api` only. MUST NOT log secrets.
- MUST NOT add services or dependencies outside `docs/TRD.md` → STACK without the user's approval.
- MUST NOT add basic/advanced modes. One mode only.
- Prefer finishing a vertical slice over polishing one layer. Follow `docs/MVP.md` → CUT-LINE when behind.
- Every task ends with: tests for its acceptance check pass, `docs/TASKS.md` status updated, commit `<type>(<feature-id>): <summary>` (e.g. `feat(F4): velocity cycling`).

## COMMANDS

```bash
npm install
npm run dev          # Vite only (no /api)
npx vercel dev       # Vite + /api functions (use this for full-stack work)
npm run test         # vitest
npm run build        # production build to dist/
npm run lint
```

## DEFINITION OF DONE (whole project)

All items in `docs/MVP.md` → ACCEPTANCE CRITERIA marked MUST pass on the deployed Vercel URL, and `docs/SUBMISSION.md` → EVIDENCE CHECKLIST is complete.
