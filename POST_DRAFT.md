---
title: The groove lives in the 40 milliseconds a grid throws away, so I built my friend a beat studio where the drummer runs in his browser
published: true
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

<!--
EDITOR NOTES (delete before publishing)
- Every [[ ]] is a placeholder. Fill it with something real or cut the sentence. Never invent a quote or a number.
- Images go in docs/evidence/ and are uploaded to DEV. Suggested shots are named in each placeholder.
- All numbers below were measured during the build (see "One thing up front"). If you re-measure on the live site, replace them.
- Ask Anuv before publishing his name, his words or his face.
-->

At 90 BPM a sixteenth note lasts **166.7 milliseconds**. Swing at 50% pushes every second one of them late by a quarter of that: **41.7 ms**. That is the whole difference between a hi-hat that marches and one that bounces, and it is smaller than a single frame of most phone videos.

My friend **Anuv** makes beats. [[ANUV MOMENT: one concrete, true moment in his words — the idea he lost because he was away from his setup, or the evening he spent digging sample packs for one kick. Two or three sentences. Ask him.]]

His ideas don't wait for him to sit down at his DAW. The beat tools he can open anywhere else are either toys — one loop, no song, no mix — or they quantise everything to the grid and throw away exactly the 40 milliseconds that make a beat feel played instead of programmed.

So I built him **Pocket**: a beat workspace in a browser tab, with open-source AI that runs on his own device and works on *his* beat, not instead of it.

## What I Built

Pocket is a minimal, hardware-feel beat studio. Anuv taps a beat on pads, gives it feel with velocity and swing, asks an open-source model to humanize it or offer four variations, makes the exact kick he is imagining by describing it, finds any sound again by its vibe, arranges beats into a song, mixes it, and exports a WAV — or MIDI for his DAW.

Four problems, four answers:

| What slows Anuv down | What Pocket does |
|---|---|
| Ideas arrive away from his setup; phone tools are toys | A full workspace (beats → song → mixer → export) in one browser tab, saved automatically |
| An empty grid is a slow start | Eight original starting beats, then everything is hands-on |
| Hours of digging sample packs for one sound | Describe it, ElevenLabs makes it, it lands on a pad |
| Sounds scattered everywhere, nothing searchable | One library, searchable by name *and* by meaning, sorted into playlists |

### One thing up front, because it changes how you read every number below

Every number in this post was **measured**, not estimated, and I am telling you where:

- Audio and AI timings come from **headless Chrome on a Windows laptop with no GPU**, against a local dev server. A real laptop with a GPU will be faster; I have not measured that yet, so I don't claim it.
- Database latencies were measured **from India to a Tiger Data service in US-East**. The deployed functions run in Vercel's `iad1` region, next to the database.
- Search was measured on **synthetic test sounds** that my test script generated, uploaded and deleted afterwards. No real user's sounds were touched.
- Where something didn't work, the error is quoted **verbatim** in [What Didn't Work](#what-didnt-work).

## Demo

**Live:** https://krisp.vercel.app

[[VIDEO: 2–3 min handover video — Anuv opening Pocket, building a tune, exporting. Embed with {% embed <url> %}]]

The sound library and saving are protected by a studio passcode (it's Anuv's library, and ElevenLabs credits cost money). The video shows those parts. Everything below works **without** the passcode.

### Verify this in 60 seconds — no keys, no passcode, no clone

1. Open https://krisp.vercel.app and click **New workspace** → pick **Lo-fi** → **Create**. If it asks for a passcode, click **Not now** — you can still make music, it just won't save.
2. Press **Space**. You're hearing a groove.
3. Shift-click a few pads in the snare row to add ghost notes. Turn **Swing**.
4. Open the **AI** tab → **Humanize**. The first run downloads the model; after that the pads change brightness — that's new velocities — and tiny ticks appear inside them — that's microtiming.
5. Open **Export** → **WAV**. You'll get a mixdown of the song through the full mixer.

### The check I would make if I were judging this

Drop that WAV into Audacity and zoom into the hi-hats. With swing at 50% and 90 BPM, every second hat should land about **41 ms** late. When I measured Pocket's own export, it landed **0.24 of a step** late — 40 ms against the 41.7 ms the formula asks for — while the even hats did not move. That is the test that tells you the export is the same engine you were listening to, not a re-implementation of it.

[[GIF: Humanize and Variations acting on a hand-made beat — docs/evidence/ai.gif]]

## Code

{% github Dronzer2code/Krisp %}

The repository was created inside the challenge window (first commit on 2026-10-03). Open-source work Pocket builds on, credited in the README: **Magenta.js** (Apache-2.0), **Tone.js** (MIT), **transformers.js** + **all-MiniLM-L6-v2** (Apache-2.0), **@tonejs/midi** (MIT), **pgvector**, and **Petaluma Script** by Steinberg (SIL OFL) for the hand-lettered user guide.

## How I Built It

```
            ┌──────────────────── Anuv's browser ────────────────────┐
            │                                                        │
 pads ──►   │  zustand store ──► scheduler ──► Tone.js engine ──► 🔊   │
            │       │   (pure timing math)      ▲                    │
            │       │                           └── same engine ──► WAV│
            │       ├──► Magenta.js (GrooVAE, MusicVAE, DrumRNN)      │
            │       └──► all-MiniLM-L6-v2 (384-d text embeddings)     │
            └───────────┬────────────────────────────────────────────┘
                        │  /api (Vercel Functions, passcode)
            ┌───────────▼──────────┐        ┌──────────────────────┐
            │ Tiger Data (Postgres │        │ ElevenLabs           │
            │ + pgvector): work-   │        │ Sound Effects API    │
            │ spaces, sounds,      │        │ (server-side only)   │
            │ hybrid search        │        └──────────────────────┘
            └──────────────────────┘
```

The rule I built everything around: **everything musical happens in the browser and never waits on the network.** Editing, playback, mixing, AI and export all run locally. The network is only for saving, the sound library, and making new sounds.

### The scheduler is pure math, and that is what makes the export honest

A drum machine in a browser is a timing problem before it is anything else. Pocket schedules every hit with look-ahead on Tone.js's Transport, and all of the timing lives in three pure functions that are unit-tested on their own:

```ts
export const stepSeconds = (bpm: number) => 60 / bpm / 4;

export function swingDelay(stepIndex: number, swing: number, stepSec: number) {
  return stepIndex % 2 === 1 ? (swing * stepSec) / 2 : 0;
}

export function hitTime(tickTime: number, stepIndex: number, step: { offset: number }, swing: number, stepSec: number) {
  const t = tickTime + swingDelay(stepIndex, swing, stepSec) + step.offset * stepSec;
  return Math.max(t, tickTime - 0.4 * stepSec); // a humanized hit may lead, but not into the previous step
}
```

The hard decision was the export. The obvious way to make a WAV is to write a second, offline renderer. I didn't. `createEngine(context)` takes *any* audio context, so the export opens a `Tone.Offline` context and runs **the same engine and the same scheduler** through it:

```ts
const rendered = await Tone.Offline(async (ctx) => {
  const engine = createEngine(ctx);           // same graph: channels, reverb, master chain
  engine.sync(ws);
  await engine.ready;                          // reverb impulse response
  bindScheduler(ctx.transport, { getWorkspace: () => ws, trigger: engine.trigger, /* … */ });
  ctx.transport.start(0);
}, seconds + 2, 2, 44100);
```

A 16-bar song at 90 BPM is 42.7 seconds of music. Pocket rendered it, plus a 2-second reverb tail, in **16.1 s** on that GPU-less laptop, and the file followed the arrangement: audio in bars 1–4, silence after (RMS 0.086 against 0.000000). Audio clips are started by the same per-tick code as drum hits, so loop regions and offline export can't drift apart.

### Magenta.js: open-source AI that edits *his* beat

Most AI music tools generate the song for you. Pocket's AI only ever acts on the beat Anuv made, and every result goes through undo.

| Tool | Model (open checkpoint) | What it changes |
|---|---|---|
| Humanize | `music_vae/groovae_2bar_humanize` (trained on the Groove MIDI Dataset of real drummers) | Only velocity and timing of steps that are already on. Never adds or removes a note. |
| Variations | `music_vae/drums_2bar_lokl_small` | Four candidates near his beat; *wildness* sets similarity and temperature. Hold one to hear it in place. |
| Continue | `music_rnn/drum_kit_rnn` | Writes bar 2 from bar 1. |
| Morph | `music_vae/drums_2bar_lokl_small` | Nine steps from one beat to another. |

Two things I only learned by running the models, both written into the converter:

- MusicVAE and DrumRNN return quantized notes with **velocity unset** (it reads as 0), so Pocket defaults them to 100.
- GrooVAE returns **unquantized** notes: a start time, not a step. Pocket recovers the step as `round(startTime / stepSeconds)` and keeps the remainder as a microtiming offset, clamped to ±half a step. That remainder *is* the groove.

And one I had to design for: Snare and Clap share the same drum pitch (38). Without care, a model's snare notes would wipe out the clap row. Model notes go to the **first** slot with a pitch; later slots with the same pitch keep their own steps.

To prove the AI is genuinely local, I ran the whole AI test suite with **every `/api` request blocked** in the browser. Humanize, Variations, Continue and Morph all passed. Measured cold, the first Humanize took **15 s** including the model download; the drums VAE took **14.2 s** to load. Both happen once.

### ElevenLabs: the end of sample-pack digging

Anuv describes a sound; Pocket shapes the prompt and shows him exactly what it sends:

- One-shot: `"<his words>, single drum one-shot, isolated, dry, no music"`
- Loop: `"<his words>, seamless drum loop, <bpm> bpm"` with `loop: true`

The call happens only on the server (`POST /v1/sound-generation`, key never in the bundle — `scripts/check-secrets.sh` greps the build for it). In the browser, one-shots are trimmed of silence, faded and peak-normalised to −1 dBFS (loops are only normalised), then embedded and stored in his library. ElevenLabs charges 40 credits per second of generated sound, so a daily limit protects the credits through judging week.

[[SCREENSHOT: Create tab with 3–4 of Anuv's real prompts and the sounds he kept — docs/evidence/create.png]]

### Tiger Data: finding a sound by its name *and* by its vibe

Producers search two ways. Sometimes it's an exact word — "808", "clap". Sometimes it's a feeling — "warm", "dusty", "something like vinyl". Keyword search fails the second; vector search fumbles the first. Pocket runs both in one query and fuses them with reciprocal rank fusion (selected columns abridged):

```sql
WITH v AS (            -- meaning: pgvector cosine on all-MiniLM-L6-v2 embeddings made in the browser
  SELECT id, row_number() OVER (ORDER BY embedding <=> $1::vector) AS r
  FROM sounds WHERE ($3::text IS NULL OR kind = $3)
  ORDER BY embedding <=> $1::vector LIMIT 50
), k AS (              -- spelling: Postgres full-text
  SELECT id, row_number() OVER (ORDER BY ts_rank(tsv, q) DESC) AS r
  FROM sounds, websearch_to_tsquery('english', $2) q
  WHERE tsv @@ q AND ($3::text IS NULL OR kind = $3)
  ORDER BY ts_rank(tsv, q) DESC LIMIT 50
)
SELECT s.id, s.name, s.kind,
       coalesce(1.0/(60+v.r),0) + coalesce(1.0/(60+k.r),0) AS score,
       v.r IS NOT NULL AS vector_hit, k.r IS NOT NULL AS keyword_hit
FROM sounds s LEFT JOIN v ON v.id = s.id LEFT JOIN k ON k.id = s.id
WHERE v.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY score DESC LIMIT 20;
```

Every result shows **which half found it** — a `vector` badge, a `keyword` badge, or both — so Anuv can see why a sound came up. In testing, *"dusty kick"* found the uploaded kick with both badges, and *"warm lo-fi bass drum"* — words that were never its name — found it by vector (plus a keyword hit on its `warm` tag).

Workspaces live in the same Postgres as JSONB; sounds live with their audio, their 384-d embedding and their tags; playlists are a two-table join so a sound can sit in several folders at once.

[[SCREENSHOT: Library results showing vector and keyword badges for two different queries — docs/evidence/search.png]]

### The hardware feel, kept minimal

The UI is calm studio hardware: one panel colour, depth only from light and shadow, one orange accent for "on". Knobs, faders, pads, LCD and LED meters are real controls — keyboard-operable, with ARIA roles and visible focus. The grid's playhead and hit flashes are applied straight to the DOM from the audio clock, so a full 9 × 32 grid never re-renders React on every tick. The initial page is **68 KB gzip**; the audio engine (70 KB) arrives with the first workspace, and the AI (≈ 229 KB for Magenta, ≈ 228 KB for transformers.js) only on first use.

## What My Friend Said

[[HANDOVER: what Anuv did on camera — the tune he made, what he exported, what he dropped into his DAW. Facts only.]]

> [[QUOTE: Anuv's own words, exactly as he said them. Do not paraphrase into a quote.]]

## Why Does Open Innovation Matter?

Because for Anuv it decides four very practical things.

1. **His beats stay on his device.** Magenta and all-MiniLM-L6-v2 run in his browser. I didn't just design it that way — I tested it with the backend blocked, and every AI tool still worked.
2. **It costs nothing to run.** There is no per-request inference bill for the AI. The only metered call in Pocket is ElevenLabs, and it's an explicit, optional step behind a daily limit.
3. **I could read what the models actually return.** Because the checkpoints and the library are open, I found out that GrooVAE hands back unquantized start times and VAE notes come back with velocity 0 — and built the converter around the truth instead of around the docs. A closed API would have been a black box with a groove I couldn't explain.
4. **Where open beat closed, here.** Once loaded, an open model in the browser has no API latency, no quota and no outage in the middle of a creative moment. I measured the cold, first-load cost (15 s for Humanize on a GPU-less machine); [[MEASURE: warm Humanize time on Anuv's laptop, then state it here]].

## What Didn't Work

Every one of these is quoted verbatim, because the honest version of a build post is more useful than the tidy one.

| What happened | The error | The fix |
|---|---|---|
| Postgres refused my search column | `generation expression is not immutable` | `array_to_string` isn't immutable, so `tsv` became a plain column every INSERT fills with the same expression |
| A brand-new Tiger service failed TLS for over an hour | `SELF_SIGNED_CERT_IN_CHAIN` | The cert came from Tiger's own CA, `ca.timescale.com`. I added that CA to Node's trust list — verification stays **on** — instead of the tempting `rejectUnauthorized: false` |
| Disabling the limiter crashed the mixer sync | `RangeError: Value must be within [-100, 0], got: 1e-7` | Tone ramps start from 1e-7 when a param is 0. Compressor and limiter params are now set, not ramped |
| Solo didn't silence the other channels | No error — the kick still read **−32 dB** with the snare soloed | `Volume.mute` was quietly undone by the next volume ramp. Mute is now its own gate stage; the kick now reads below the meter floor |
| The limiter didn't limit | No error — limiter on: **+6.4 dBFS** peak; off: **+7.2 dBFS** | WebAudio's compressor adds makeup gain and lets transients through; even a raw −12 dB / 20:1 compressor left a 0 dB sine at −4.2 dBFS. A soft clipper at the ceiling now holds peaks at exactly **−6.0 dBFS** (off: +6.9) |
| TypeScript gave up on transformers.js | `Expression produces a union type that is too complex to represent.` | A typed wrapper around `pipeline()` |
| Vercel blocked deployments after a teammate's merge | Deployments showed **Blocked** | The Hobby plan only deploys private-repo commits authored by the owner. Pushing an owner-authored commit unblocked it; a public repo avoids it |
| Saving felt slow in local dev | ~3 s per request | Measured: 2.16 s TLS connect + 0.26 s per query, India → US-East, and `vercel dev` opens a new connection per request. Production runs next to the database and reuses its pool |

### What's real and what's simplified

| Real | Simplified, on purpose |
|---|---|
| Magenta models, running in the browser | The default kit is synthesised drums (Tone.js), not recorded samples — Anuv's own sounds replace them |
| ElevenLabs generation, server-side | No time-stretching: loops play at their own length; a warning dot shows when a loop doesn't fit the bar grid |
| pgvector + full-text hybrid search with RRF | A shared studio passcode instead of user accounts — it's built for one person |
| The WAV export *is* the playback engine | 4/4 only, 16 or 32 steps |
| 146 unit tests + browser end-to-end checks on the acceptance criteria [[VERIFY: run one ElevenLabs generation and the daily-limit message on the live site, then drop this note]] | A daily generation limit, to keep the demo alive through judging |

## My Agent Session

Pocket was built with Claude Code, and the sessions were captured with Entire:

[[ENTIRE: session links for the key parts — the engine + scheduler, the offline export, the hybrid search, the TLS fix]]

## Prize Categories

- **Best Use of ElevenLabs** — custom one-shots and loops generated inside the workflow, replacing sample-pack digging
- **Best Use of Tiger Data** — pgvector + full-text hybrid search with visible match reasons; workspaces, sounds and playlists in Postgres
- **Best Use of Entire** — the agent sessions that built Pocket, linked above

## Team

[[TEAM: @dronzer2code and the DEV usernames of every teammate]]

---

*Built within the challenge window with AI pair programming. All preset beat patterns are original to this project. The sounds used in the search measurements were synthetic test tones, generated, uploaded and deleted by the test script. Anuv's name, words and music appear with his permission.* [[CONFIRM before publishing]]
