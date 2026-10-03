# TASKS.md — Pocket

## PURPOSE

Ordered build tasks with owner, dependencies, timebox, and acceptance check. Agents work in dependency order and update STATUS.
What to build: `docs/TRD.md`. Acceptance IDs (AC-*): `docs/MVP.md`. Prompts to start each task: `BUILD_PROMPTS.md`.

## CONTEXT

- Person A: data, backend, sounds, AI, export pipeline. Person B: UI primitives, Beat Editor, Song, Mixer UI, polish.
- Times are relative to the team's start (H+0). Absolute limits: code freeze **2026-10-04T23:00:00Z**; post published by **2026-10-05T06:30:00Z** (deadline 06:59).
- Timeboxes are maximums. Over the box → apply `docs/MVP.md` → CUT-LINE.

## CHECKPOINTS

| ID | Target | Condition |
|---|---|---|
| CP0 | H+1 | Repo, Entire, scaffold running; Tiger schema applied |
| CP1 | H+2 | Magenta smoke test passes (or UMD fallback) |
| CP2 | H+6 | Hand-made Beat plays with swing through the mixer graph |
| CP3 | H+10 | Workspaces save/load; Song plays 3 Beats in order |
| CP4 | H+15 | Create/Upload/Library/Search work; audio lanes play loops |
| CP5 | H+18 | Mixer drawer + Humanize + Variations + WAV export work |
| CP6 | H+20 / code freeze | Deployed; all MUST acceptance criteria pass on live URL |
| CP7 | before 2026-10-05T06:30:00Z | Handover filmed, post published |

## TASK LIST

STATUS: `TODO` · `DOING` · `DONE` · `CUT`.

| ID | Owner | Task | Depends | Box | Acceptance check | STATUS |
|---|---|---|---|---|---|---|
| T0 | both | Repo source per `CLAUDE.md` → REPOSITORY SOURCE; Entire set up (`docs/SETUP.md`); Vite+React+TS+Tailwind+zustand+tone scaffold; tokens.css; `.env.example`; `scripts/check-secrets.sh` | — | 1 h | `npm run dev` renders Home placeholder | DONE |
| T0b | A | Run `db/schema.sql` in Tiger; `api/_lib/*`; `/api/workspaces` GET returns `[]` via `npx vercel dev` | T0 | 45 min | VERIFY-5, VERIFY-6 recorded | DOING |
| T1 | A | Magenta smoke test route: load MusicVAE drums, sample, log; fallback if needed | T0 | 45 min | VERIFY-1, VERIFY-2 recorded | TODO |
| T2 | B | UI primitives (Panel, Knob, Fader, Pad, LedButton, Lcd, Meter, Toggle, Chip, Tabs, Dialog, Tooltip) + `/kit` demo route | T0 | 2.5 h | All primitives keyboard/touch operable, ARIA present | TODO |
| T3 | A | `model/types.ts`, `defaults.ts`, `presets/kit.ts`, `presets/beats.ts`, store + history (coalescing) + tests | T0 | 2 h | presets.test, store.test pass | TODO |
| T4 | A | `audio/context.ts`, `engine.ts` (full graph), `voices.ts`, `buffers.ts`, `scheduler.ts` BEAT mode + tests | T3 | 2.5 h | scheduler.test passes; CP2 | TODO |
| T5 | B | Workspace screen layout, TransportBar (play/stop, mode, LCD BPM, tap, swing, undo/redo, position), Rack, BeatEditor, BeatChips | T2, T3 | 3 h | AC-F2.1, AC-F2.2, AC-F2.3, AC-F3.1, AC-F3.3, AC-F4.1–4 | TODO |
| T6 | A | `/api/workspaces` full CRUD, `api/client.ts`, PasscodeGate, autosave + save LED, Home screen + New workspace dialog | T0b, T3, T2 | 2.5 h | AC-F1.1–3, AC-F11.1 | TODO |
| T7 | B | Song: ruler, lanes, Beat clips (drop, move, resize, delete), previews, SONG scheduling, delete-beat confirmation | T4, T5 | 3 h | AC-F2.4, AC-F5.2, AC-F5.3; CP3 | TODO |
| T8 | A | `analyze.ts`, `ai/embed.ts`, `/api/sounds`, `/api/sound-generate`, `/api/sound-audio`, `/api/search`; SoundBrowser (4 tabs), Use → Slot / AUDIO lane; audio clips playback | T6, T7 | 3.5 h | AC-F3.2, AC-F5.1, AC-F6.1–3, AC-F7.1; VERIFY-3, VERIFY-4; CP4 | TODO |
| T9 | B | Mixer drawer: ChannelStrip, Reverb return, MasterStrip, meters, solo logic | T4, T5 | 2 h | AC-F8.1–3 | TODO |
| T10 | A | AI: convert.ts + tests, Humanize, Variations (AIPanel) | T1, T5 | 2 h | AC-F9.1–3 | TODO |
| T11 | B | Export: wav-encoder + tests, export-wav via Tone.Offline, ExportDialog | T4, T7, T9 | 1.5 h | AC-F10.1; VERIFY-7; CP5 | TODO |
| T12 | both | Deploy to Vercel, env vars, run every MUST acceptance criterion on live URL; `check-secrets.sh` | T6–T11 | 1 h | AC-F11.2; CP6 | TODO |
| T13 | B | SHOULD batch in cut-line order reversed: loop region, metronome, clip duplicate, lane rename/delete, channel/master EQ, GR LED, waveform thumbnails | T12 | ≤ 2 h | Each item's AC or visible behaviour | TODO |
| T14 | A | SHOULD: MIDI export, Continue, Morph, live record | T12 | ≤ 2 h | AC-F10.2 | TODO |
| T15 | both | Polish pass against `docs/UI_DESIGN.md` (spacing, labels, focus, motion, empty states, copy) | T12 | 1 h | Checklist in UI_DESIGN principles | TODO |
| T16 | both | Handover with friend (demo scenario from `docs/MVP.md`), record video, collect quote | T12 | 1.5 h | Video + quote saved | TODO |
| T17 | both | Write and publish post per `docs/SUBMISSION.md` | T16 | 3 h | Published with tags before CP7 | TODO |

## PARALLELISM

- After T0: A runs T0b → T1 → T3 → T4; B runs T2.
- B starts T5 once T2 and T3 land; A runs T6 meanwhile.
- T7 (B) and T8 (A) run in parallel; T9 (B) and T10 (A) next; T11 (B) last before deploy.
- Start the post draft (T17 skeleton) during T13–T15 waits.

## RELATED DOCUMENTS

`docs/MVP.md`, `docs/TRD.md`, `docs/SETUP.md`, `docs/SUBMISSION.md`, `BUILD_PROMPTS.md`.
