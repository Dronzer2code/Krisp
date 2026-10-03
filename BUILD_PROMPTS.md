# BUILD_PROMPTS.md — Pocket

## PURPOSE

Ordered prompts the humans paste into Claude Code to build Pocket. Each prompt maps to tasks in `docs/TASKS.md`. Send the next prompt only after the agent reports the previous checkpoint.

## CONTEXT

- Source of truth: `CLAUDE.md` and `docs/`. Doc rules: `AGENT.md`.
- Two Claude Code sessions can run in parallel (Person A / Person B) after Prompt 0. `git pull` before each prompt; commit at the end of each.
- Human-only steps are in `docs/SETUP.md`.

## PROMPT 0 — Repository, Entire, scaffold (both, T0)

```text
Read CLAUDE.md, AGENT.md and every file in docs/ before doing anything.

1. Repository source: follow CLAUDE.md → REPOSITORY SOURCE exactly. The user gave /et/krisp/krisp. If it exists locally, set up the entire repo there as the project root. If not, STOP and ask me for the full clone URL — do not guess. Check git history and warn me if there are commits before 2026-10-02T02:00:00Z or non-trivial existing code.
2. Make sure CLAUDE.md, AGENT.md, BUILD_PROMPTS.md and docs/ are in the project root. Delete any old POCKET_SPEC.md.
3. Entire: set up Entire for this repo per docs/SETUP.md §1 using only commands verified in https://docs.entire.io. If you cannot verify them, give me the exact manual steps instead.
4. Scaffold per docs/TRD.md → STACK and REPOSITORY LAYOUT (Vite, React 18, TS, Tailwind, zustand, tone, @tonejs/midi, @magenta/music, @huggingface/transformers, pg, vitest). Add .env.example, .gitignore, scripts/check-secrets.sh, src/theme/tokens.css from docs/UI_DESIGN.md, fonts.
5. Home placeholder renders a Panel with "POCKET".
Report status of each step. Commit "chore(T0): scaffold".
```

## PROMPT 1A — Database and API base (Person A, T0b)

```text
docs/TRD.md → DATABASE, API CONTRACTS, api/_lib. Write db/schema.sql exactly; tell me to paste it into the Tiger SQL editor and wait for my confirmation.
Implement api/_lib/db.ts, auth.ts, http.ts and GET /api/workspaces. Test with `npx vercel dev`.
Record VERIFY-5 and VERIFY-6 results in the VERIFY REGISTER. Commit.
```

## PROMPT 1B — Magenta smoke test (Person A, T1)

```text
docs/TRD.md → AI INTEGRATION, VERIFY-1, VERIFY-2. Create a dev-only route that loads the MusicVAE drum checkpoint, samples one sequence and logs it. If @magenta/music fails under Vite, implement the UMD fallback in src/ai/magenta.ts.
Verify checkpoint names and method signatures (similar, interpolate, encode/decode, continueSequence, GrooVAE humanize) and record them. Commit.
```

## PROMPT 2 — UI primitives (Person B, T2)

```text
docs/UI_DESIGN.md → DESIGN PRINCIPLES, DESIGN TOKENS, PRIMITIVES, MOTION, ACCESSIBILITY.
Build every primitive in src/ui/ with the specified sizes, states, interactions and ARIA, plus a /kit demo route showing them with live values.
Minimal skeuomorphism: calm studio hardware, depth only from light and shadow, one accent colour. Commit.
```

## PROMPT 3 — Model, presets, store (Person A, T3)

```text
docs/TRD.md → DATA MODEL, Defaults, PRESETS. Implement model/, presets/kit.ts, presets/beats.ts (decode the row strings), store/workspace.ts with history (100 snapshots, drag coalescing) and all edit actions implied by docs/PRD.md F1–F5, F8.
Write presets.test and store.test. Commit.
```

## PROMPT 4 — Audio engine and scheduler (Person A, T4)

```text
docs/TRD.md → AUDIO ENGINE, SCHEDULING (BEAT mode first). Implement audio/context.ts, engine.ts (createEngine(ctx) for live and offline contexts, full channel/reverb/master graph), voices.ts, buffers.ts, scheduler.ts with pure timing functions + scheduler.test.
Demonstrate a hard-coded Beat playing with swing and velocity. Commit.
```

## PROMPT 5 — Workspace screen, transport, rack, beat editor (Person B, T5)

```text
docs/UI_DESIGN.md → Workspace layout, Rack row, Beat Editor; docs/PRD.md F2, F3, F4; docs/MVP.md AC-F2.x, AC-F3.x, AC-F4.x.
Build TransportBar, Rack, SlotRow, BeatChips, BeatEditor using src/ui primitives and the store/engine from Prompts 3–4. Grid playhead via an external store (no per-tick React re-render of all pads). Keyboard shortcuts from UI_DESIGN.
Report each acceptance criterion PASS/FAIL. Commit.
```

## PROMPT 6 — Workspaces, autosave, Home, passcode (Person A, T6)

```text
docs/TRD.md → API CONTRACTS (workspaces), FRONTEND API CLIENT; docs/PROCESS_FLOW.md SF1, SF5, Save status machine; docs/UI_DESIGN.md Home.
Implement full /api/workspaces, api/client.ts, PasscodeGate, autosave with save LED, Home with cartridges and New workspace dialog (empty or preset).
Report AC-F1.x and AC-F11.1. Commit.
```

## PROMPT 7 — Song (Person B, T7)

```text
docs/PRD.md F5; docs/TRD.md SCHEDULING (SONG mode); docs/UI_DESIGN.md Song; docs/PROCESS_FLOW.md J7.
Build Song with ruler, lanes, Beat clips (drop from chips, move, resize with repeat, delete), previews, SONG playback, delete-beat confirmation. Audio lanes render; audio clips arrive in Prompt 8.
Report AC-F2.4, AC-F5.2, AC-F5.3. Commit.
```

## PROMPT 8 — Sounds, ElevenLabs, upload, search, audio clips (Person A, T8)

```text
docs/TRD.md → SOUND ANALYSIS, Embeddings, API CONTRACTS (sounds, sound-generate, sound-audio, search), hybrid search SQL; docs/PROCESS_FLOW.md J4–J6, SF2–SF4; docs/UI_DESIGN.md Side panel Sounds.
Verify the ElevenLabs endpoint (VERIFY-3) and transformers.js options (VERIFY-4) first.
Build SoundBrowser (Presets, Create, Upload, Library), Use → Slot / AUDIO lane, audio clip playback in SONG mode, daily limit UI.
Report AC-F3.2, AC-F5.1, AC-F6.x, AC-F7.1. Commit.
```

## PROMPT 9 — Mixer (Person B, T9)

```text
docs/PRD.md F8; docs/TRD.md AUDIO ENGINE graph; docs/UI_DESIGN.md Mixer.
Build the Mixer drawer: ChannelStrip per Slot and AUDIO lane, Reverb return, MasterStrip (EQ, compressor + GR LED, limiter, reverb, fader), meters, solo logic. Coalesce fader/knob drags into single undo entries.
Report AC-F8.x. Commit.
```

## PROMPT 10 — AI tools (Person A, T10)

```text
docs/TRD.md → AI INTEGRATION + Conversion; docs/UI_DESIGN.md AI panel; docs/PROCESS_FLOW.md J9 and AI model state machine.
Implement convert.ts + convert.test, Humanize, Variations (wildness, 4 candidates, hold-to-audition, Apply, Add as new beat). Every result goes through undo history.
Report AC-F9.x. Commit.
```

## PROMPT 11 — Export (Person B, T11)

```text
docs/TRD.md → EXPORT (VERIFY-7 first). Implement wav-encoder + wav.test, export-wav (Tone.Offline reusing createEngine and the scheduler math), ExportDialog with progress.
Report AC-F10.1. Commit.
```

## PROMPT 12 — Deploy and verify (both, T12)

```text
Follow docs/SETUP.md §5–6. Tell me exactly what to enter in the Vercel dashboard. After deploy, run every MUST acceptance criterion in docs/MVP.md on the live URL and report PASS/FAIL with evidence. Run scripts/check-secrets.sh. Fix failures only. Commit "release(T12): v1".
```

## PROMPT 13 — SHOULD items (T13 / T14, only if CP6 passed)

```text
Implement SHOULD items from docs/MVP.md in reverse cut-line order (most valuable first) until 2026-10-04T23:00:00Z: loop region, metronome, MIDI export, channel/master EQ + GR LED, clip duplicate, lane rename/delete, waveform thumbnails, Continue, Morph, live record. One commit per item; stop immediately at code freeze.
```

## PROMPT 14 — Polish (both, T15)

```text
Audit the app against docs/UI_DESIGN.md (principles, spacing, labels, focus rings, motion, reduced motion, empty states, copy, responsive breakpoints). List issues, fix them, no new features. Update README.md (what Pocket is, live URL, setup, credits for Magenta.js, Tone.js, transformers.js, all-MiniLM-L6-v2, @tonejs/midi, "Commits after deadline" section). Commit.
```

## PROMPT 15 — Post draft (both, T17)

```text
Using docs/SUBMISSION.md, draft the DEV post in POST_DRAFT.md with every required section and the checklist evidence I have collected in docs/evidence/. Leave clearly marked placeholders for the friend's name, quote, video link, Entire session links and team usernames. Never invent quotes or numbers.
```
