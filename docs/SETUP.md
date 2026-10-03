# SETUP.md — Pocket

## PURPOSE

Human and agent setup steps for every account, key and environment Pocket needs, in dependency order, plus smoke tests. Implements task T0/T0b in `docs/TASKS.md`.

## CONTEXT

- Services: Tiger Data (database), ElevenLabs (sound generation), Vercel (hosting + functions), Entire (agent session sharing). None requires a credit card for the planned usage (verify at signup).
- Four environment variables total (see `docs/TRD.md` → CONFIGURATION).

## ORDER

```text
1 Repository source + Entire      (agent + human, 15 min)
2 Tiger Data                      (human 5 min, agent 5 min)
3 ElevenLabs key                  (human, 3 min)
4 Local .env + npx vercel dev     (agent, 10 min)
5 Vercel deploy                   (human 5 min, after the app runs locally)
6 Smoke tests                     (agent, 10 min)
```

## 1 REPOSITORY SOURCE AND ENTIRE

- Repository source: the Entire repository `/et/krisp/krisp`, git remote `origin` (`entire://aws-ap-south-1.entire.io/et/krisp/krisp`). Mirrored to GitHub at git remote `github` (`https://github.com/Dronzer2code/Krisp.git`) for Vercel. Rules: `CLAUDE.md` → REPOSITORY SOURCE.
- Every commit is pushed to both remotes: `git push origin main` then `git push github main`.
- The GitHub repository MUST be public before deploy (Vercel import + post embed).
- **Entire:** create an account and follow https://docs.entire.io to capture the Claude Code sessions used to build Pocket for this repository. Verified 2026-10-03 (https://docs.entire.io/agents/claude-code and `entire enable --help`, CLI 0.11.3): `entire enable --agent claude-code` (repo setup + Claude Code hooks; `entire agent add claude-code` installs hooks only, into `.claude/settings.json`). DONE 2026-10-03: ran `entire enable --agent claude-code --import-history` → 8 Claude Code hooks in `.claude/settings.json`, project config `.entire/settings.json` (checkpoints stored as git refs), the first build session imported. Checkpoints sync to remote `origin` on `git push origin`. Every teammate's machine needs the Entire CLI on PATH (`entire login`) or its hooks silently do nothing. Keep the session links for `docs/SUBMISSION.md`.

## 2 TIGER DATA

1. Sign up at https://console.cloud.tigerdata.com/signup → choose the free option.
2. Create a service (free size), name `pocket-db`, region closest to Vercel's default function region you will use.
3. Download the credentials file immediately (password shown once). Defaults: user `tsdbadmin`, database `tsdb`.
4. Copy the connection string → 
`TIGER_DATABASE_URL=postgres://tsdbadmin:<pw>@<host>:<port>/tsdb?sslmode=require`.
5. Open the service's **SQL editor** in Tiger Console → paste `db/schema.sql` → run. Confirm tables `workspaces`, `sounds`, `sound_usage` exist (`\dt` or the console table list). If the generated `tsv` column errors, apply the TRD fallback (VERIFY-6).

## 3 ELEVENLABS

1. Claim Hacktoberfest promo credits at https://hacktoberfest.com/my/promos.
2. elevenlabs.io → profile → **API Keys** → create → `ELEVENLABS_API_KEY`.
3. Note remaining credits; set `DAILY_SOUND_LIMIT` so the demo and judging week fit inside them.

## 4 LOCAL DEVELOPMENT

```bash
cp .env.example .env      # fill the 4 variables
npm install
npx vercel login          # once
npx vercel link           # once; links the folder to a Vercel project (creates it if needed)
npx vercel dev            # Vite + /api on http://localhost:3000
```

`.env` example:

```bash
TIGER_DATABASE_URL=postgres://tsdbadmin:...@...:.../tsdb?sslmode=require
ELEVENLABS_API_KEY=...
APP_PASSCODE=choose-a-passcode
DAILY_SOUND_LIMIT=40
```

## 5 VERCEL DEPLOY

1. https://vercel.com → sign in with GitHub → **Add New → Project** → import the repo.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist` (defaults).
3. **Environment Variables:** add the 4 variables for Production (and Preview).
4. **Deploy.** Every push to `main` redeploys.
5. Open the live URL on desktop and phone.

## 6 SMOKE TESTS

| # | Test | Pass |
|---|---|---|
| S1 | `curl -s -H "x-app-passcode: $APP_PASSCODE" <url>/api/workspaces` | `{"workspaces":[]}` or list |
| S2 | Same without header | 401 |
| S3 | Create a Workspace in the UI, refresh | Workspace persists |
| S4 | Generate a 1 s one-shot | Appears in Library, plays |
| S5 | Search the sound's name | Result with keyword badge |
| S6 | Humanize on a preset Beat | Velocities change |
| S7 | `npm run build && scripts/check-secrets.sh` | No secrets in `dist/` |

## RELATED DOCUMENTS

`CLAUDE.md`, `docs/TRD.md`, `docs/TASKS.md`.
