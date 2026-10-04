# CONTEXT.md — Pocket build state

## PURPOSE

Hand-off snapshot for any agent session that continues building Pocket. States what exists, what was decided during the build (including deviations from the spec), how to run and verify, and what is still open. Read after `CLAUDE.md`; the specs in `docs/` remain the source of truth for requirements.

Last updated: 2026-10-04 (latest commit `3821c5b` before this file).

## CURRENT STATE

| Task | Status | Notes |
|---|---|---|
| T0, T0b, T1–T7, T9–T11, T13, T14 | DONE | See `docs/TASKS.md` |
| T8 Sounds | DOING | Built. AC-F6.1 (ElevenLabs generate) and AC-F6.3 (daily limit) untested: `ELEVENLABS_API_KEY` is empty in `.env` |
| T12 Deploy | TODO | Needs the user (see NEXT ACTIONS) |
| T15 Polish | DOING | README done; responsive 1440/1050/390 px checked; full UI_DESIGN audit not done |
| T16 Handover, T17 Post | TODO | Human tasks; agent may draft `POST_DRAFT.md` (BUILD_PROMPTS → PROMPT 15) |

- All MUST acceptance criteria pass locally except AC-F6.1, AC-F6.3 (no key) and AC-F11.2 on a live URL (not deployed yet; `scripts/check-secrets.sh` passes on local `dist/`).
- 119 vitest tests pass; `npm run lint` and `npx tsc --noEmit` are clean.
- Database is empty (test rows deleted 2026-10-03).

## ENVIRONMENT

- Repo remotes: `origin` = Entire (`/et/krisp/krisp`), `github` = `https://github.com/Dronzer2code/Krisp.git`. After every commit: `git push origin main` and `git push github main`.
- Entire session capture is enabled (`.claude/settings.json` hooks, `.entire/settings.json`). Checkpoints upload on `git push origin`.
- `.env` (root, gitignored): `TIGER_DATABASE_URL` set, `APP_PASSCODE` set, `DAILY_SOUND_LIMIT=40`, `ELEVENLABS_API_KEY` empty. MUST NOT print or commit values.
- Tiger service `pocket-db` is in AWS us-east. Vercel project `krisp` is linked locally (`.vercel/`, gitignored); not yet connected to GitHub or deployed.
- Run locally: `npx vercel dev` → http://localhost:3000. `npm run dev` has no `/api`.
- The user's uncommitted edit to `.env.example` (adds `VERCEL_OIDC_TOKEN`) is left as-is on purpose.

## DECISIONS AND DEVIATIONS FROM SPEC

All are also recorded in the doc named.

| Topic | Decision | Recorded in |
|---|---|---|
| TLS to Tiger | Tiger serves a cert from its private CA `ca.timescale.com`. `api/_lib/db.ts` strips `sslmode` from the URL and trusts Node roots + `api/_lib/tiger-ca.ts`; verification stays on. MUST NOT use `rejectUnauthorized:false` | TRD VERIFY-5 |
| `sounds.tsv` | Plain `tsvector NOT NULL` filled by each INSERT (`api/_lib/sounds.ts`); generated column was rejected | TRD DATABASE, VERIFY-6 |
| Magenta import | Import `@magenta/music/esm/music_vae` and `/esm/music_rnn`, not the package root | TRD VERIFY-1 |
| Mute/solo | Separate gate `Gain` after Channel Volume; `Volume.mute` was undone by later ramps | TRD AUDIO ENGINE |
| Dynamics params | Set via `param.value`, not ramped (Tone ramps from 1e-7 when value is 0) | TRD AUDIO ENGINE |
| Limiter | WaveShaper soft clipper `c·tanh(x/c)` after Master Volume, no oversampling; guarantees peaks ≤ ceiling | TRD AUDIO ENGINE |
| Audio clips | Started by the step scheduler (`audioStartsAt`), not synced Players; loop region applied by `wrapTick`, Transport never loops | `src/audio/scheduler.ts` |
| Shared pitch | Model notes go to the first Slot with a pitch; later Slots with the same pitch (Clap 38) keep their steps | `src/ai/convert.ts` |
| Extra endpoint | `GET /api/sound-generate` → `{ remainingToday, limit }` | TRD API CONTRACTS |
| UI sizes | Rack 264 px (was 240); Mixer drawer 330 px tall, strips 84 px; `--ink-soft` `#5E5A53` for WCAG AA | UI_DESIGN |
| Library playlists | `playlists` + `playlist_sounds` tables (migration `db/migrations/002_playlists.sql`, applied); `/api/playlists`; sound rename/copy/delete on `/api/sounds`; state in `src/store/library.ts`; `Menu` supports `submenu` | TRD DATABASE, API CONTRACTS |
| Router | Own minimal router (`src/router.tsx`); no router dependency | — |
| Dev-only routes | `/kit`, `/dev/magenta`, `/dev/audio` (excluded from production builds) | `src/App.tsx` |
| vercel.json | Not needed: default region `iad1`, Hobby max duration 300 s | SETUP §5 |

## CODE MAP

- Store: `src/store/ops.ts` (pure edits), `history.ts` (undo, gesture coalescing), `workspace.ts` (zustand + `actions`; modes `push` / `gesture` + `endGesture()` / `silent`), `ui.ts` (non-saved screen state).
- Audio: `src/audio/engine.ts` (graph), `voices.ts`, `scheduler.ts` (pure timing + `bindScheduler`), `context.ts` (live engine, play/stop), `export-wav.ts` (Tone.Offline, same engine), `export-midi.ts`, `audition.ts`, `buffers.ts`, `analyze.ts`.
- AI: `src/ai/magenta.ts` (lazy load, model cache, status), `convert.ts`, `tools.ts`, `embed.ts`.
- API: `api/workspaces.ts`, `sounds.ts`, `sound-generate.ts`, `sound-audio.ts`, `search.ts`, `api/_lib/*`.
- Screens: `src/screens/Home.tsx`, `Workspace.tsx`, `src/screens/workspace/*`.

## GOTCHAS

- Edit docs with the Edit tool or Python (`encoding='utf8'`). PowerShell 5.1 `Get-Content`/`Set-Content` corrupts UTF-8 (→, —, ·).
- `vercel dev` opens a new DB connection per request (~2–3 s); first request after editing an `/api` file is slower. Not a production issue.
- Headless browser tests: Vite serves HMR-updated modules as `file.ts?t=…`; tests that `import()` app modules must import that exact URL or they get a second instance.
- Browser test scripts (CDP driver `cdp.mjs`, `e2e-t5t6.mjs` … `e2e-t11.mjs`) live in the session scratchpad, not the repo. Tests that create data must clean it up afterwards.

## NEXT ACTIONS

1. User adds `ELEVENLABS_API_KEY` to `.env` and restarts `npx vercel dev` → test AC-F6.1 and AC-F6.3, mark T8 DONE.
2. Deploy (T12): user connects Vercel project `krisp` to the public GitHub repo and adds the 4 env vars (Production + Preview), or explicitly approves the agent running `vercel env add` + `vercel deploy --prod`. Then run every MUST criterion on the live URL, run `scripts/check-secrets.sh`, put the URL in `README.md`, commit `release(T12): v1`.
3. Finish T15 audit against `docs/UI_DESIGN.md`.
4. Draft `POST_DRAFT.md` per `docs/SUBMISSION.md` when the user asks; never invent quotes or numbers.

## RELATED DOCUMENTS

`CLAUDE.md`, `docs/TASKS.md`, `docs/TRD.md` (VERIFY REGISTER), `docs/SETUP.md`, `docs/UI_DESIGN.md`, `docs/SUBMISSION.md`.
