# SUBMISSION.md — Krisp

## PURPOSE

Defines the DEV post that submits Krisp: required structure and tags, title options, evidence per prize category, the open-innovation section, writing rules aligned with judging, and compliance checks. Used by task T17 in `docs/TASKS.md`.

## CONTEXT

- Challenge page: https://dev.to/challenges/hacktoberfest-weekend-2026-10-01
- Deadline 2026-10-05T06:59:00Z; publish target 06:30.
- Judging, heaviest first: Writing Quality, Relevance to Prompt and Theme, Creativity, Technical Execution, Use of Partner Technology. A thin write-up does not win.
- English required for prizes. 18+ only. Team up to 4; one member publishes and lists teammates' DEV usernames (UNKNOWN).

## REQUIRED STRUCTURE

Front matter:

```text
---
title: <TITLE>
published: true
tags: devchallenge, weekendchallenge, hf26challenge
---
```

First body line (verbatim):

```text
*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*
```

Sections in order:

| Section | Content |
|---|---|
| `## What I Built` | Open with the friend (name only with permission) and one concrete moment of his problem (e.g., an idea lost because he wasn't at his DAW; hours digging for one kick). Then Krisp in 3–4 sentences. |
| `## Demo` | Live Vercel URL + 2–3 min video following `docs/MVP.md` → DEMO SCENARIO. Do not publish the passcode; say the library is passcode-protected and the video shows it. |
| `## Code` | Embedded GitHub repo; note it was created during the challenge window. |
| `## How I Built It` | One architecture diagram (browser does music + AI; `/api` + Tiger + ElevenLabs), then short subsections: Magenta.js (open AI), ElevenLabs, Tiger Data hybrid search, the audio engine and offline export, the skeuomorphic UI. One hard decision in depth (recommended: scheduling with look-ahead and reusing the same engine for offline WAV export so the export matches playback). |
| `## What My Friend Said` | Handover reaction + quote (never invented). |
| `## Why Does Open Innovation Matter?` | See OPEN INNOVATION SECTION. |
| `## What Didn't Work` | Honest problems and fixes. |
| `## My Agent Session` | Entire session links / embeds. |
| `## Prize Categories` | Best Use of ElevenLabs · Best Use of Tiger Data · Best Use of Entire |
| Team | DEV usernames of all members. |

## TITLE OPTIONS

- "My friend makes beats. I built him a pocket studio where the AI runs in his browser."
- "Krisp: a hardware-feel beat workspace for my producer friend (Magenta in the browser + ElevenLabs + Tiger hybrid search)"
- "I built my friend the beat sketchpad he actually wanted: tap, humanize, arrange, export"

## EVIDENCE CHECKLIST

Store screenshots/GIFs in `docs/evidence/`.

### ElevenLabs
- [ ] 3–4 prompts and the resulting sounds used in the friend's tune (screenshot of Create tab + Library).
- [ ] Short explanation: generated one-shots/loops replace sample-pack digging; prompt shaping for drum one-shots.

### Tiger Data
- [ ] The hybrid search SQL (from `docs/TRD.md`).
- [ ] Screenshot of results showing `vector` and `keyword` badges for two different queries.
- [ ] Why both: exact tags ("808", "clap") vs vibe words ("warm", "dusty").
- [ ] Workspaces stored as JSONB; Sounds with pgvector embeddings created by an open model in the browser.

### Entire
- [ ] Links/embeds of the agent sessions that built key parts (engine, scheduler, search).

### Open AI core
- [ ] GIF: Humanize and Variations acting on a hand-made Beat.
- [ ] Note: models load once from public checkpoints and run locally.

### Theme
- [ ] Friend using Krisp on camera; quote; what he exported to his DAW.

## OPEN INNOVATION SECTION

Cover each with a concrete fact:

1. **Runs on his device:** Magenta (trained on the open Groove MIDI Dataset of real drummers) and all-MiniLM-L6-v2 run in the browser; his beats never go to an AI server.
2. **Costs nothing to run:** no per-request inference bills; only optional ElevenLabs calls cost credits.
3. **Inspectable and swappable:** open checkpoints the team chose deliberately; could be replaced or fine-tuned later.
4. **Where open beat closed here:** instant, offline-capable beat tools with no API latency or quota during creative flow (state measured load time once cached).

Unmeasured claims MUST NOT appear.

## WRITING RULES

- Lead with the person and the problem, not the stack.
- Short sections, one diagram, 3–5 images/GIFs, one video. Avoid walls of bullets.
- Each partner subsection answers: what job it does, why this tech, evidence.
- Proofread; clarity over length.
- No real personal data beyond what the friend approved.

## COMPLIANCE CHECKLIST

- [ ] Repo created inside the window (2026-10-02T02:00:00Z – 2026-10-05T06:59:00Z); post-deadline commits listed in README.
- [ ] Non-trivial reused open-source code credited (Magenta.js, Tone.js, transformers.js, all-MiniLM-L6-v2, @tonejs/midi).
- [ ] Required tags and first line present; English.
- [ ] Prize categories listed only for technologies actually used.
- [ ] Live demo stays up through judging week (Vercel free; Tiger free; ElevenLabs daily limit protects credits).

## RELATED DOCUMENTS

`docs/PRD.md`, `docs/MVP.md`, `docs/TASKS.md`.
