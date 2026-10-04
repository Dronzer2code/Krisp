---
title: The groove is the 40 milliseconds a grid throws away, so we built a beat studio that gives them back, in a browser tab
published: true
tags: devchallenge, weekendchallenge, hf26challenge
cover_image: [[UPLOAD Blog images/05-workspace-overview.png TO DEV AND PASTE ITS URL]]
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

<!--
EDITOR NOTES (delete before publishing)
- Images: upload each file from "Blog images/" in the DEV editor and replace the relative path with the URL DEV gives you.
- Every [[ ]] is a placeholder. Fill it with something real or cut the sentence. Never invent a quote or a number.
- Ask Anuv before publishing his name, his words or his face.
-->

At 90 BPM a sixteenth note lasts **166.7 ms**. Swing at 50% pushes every second one of them late by **41.7 ms**. That is the entire difference between a hi-hat that marches and one that bounces, and it is shorter than one frame of most phone videos.

A plain step grid snaps every hit onto those 166.7 ms boundaries and throws the 40 ms away. We built one that keeps them, and then asked a harder question.

The single most common mistake in a multi-sponsor project is using each sponsor as a logo. A drum machine that stores a JSON blob somewhere is not a database project. A text box that calls an API once is not a sound-design project.

**So the first question was: what can each piece do that the others physically cannot?**

| Piece | The one thing only it can do here |
|---|---|
| The browser | Play audio with sample-accurate timing and run open-source models on the user's own device |
| **Tiger Data** | Keep workspaces, audio, 384-d embeddings and a full-text index in **one** Postgres, and answer "find me a warm, dusty kick" with a single SQL statement |
| **ElevenLabs** | Produce a sound that exists in no sample pack, from a sentence |
| **Entire** | Keep the agent's reasoning next to the commit it produced, so the build itself is reviewable |

My friend **Anuv** makes beats, and his ideas don't wait for him to be at his setup. [[ONE TRUE SENTENCE IN HIS WORDS ABOUT A LOST IDEA OR A NIGHT OF SAMPLE-PACK DIGGING]] Pocket is what we built him.

## What I Built

**Pocket** is a minimal, hardware-feel beat studio in a browser tab. You tap a beat on pads, give it feel with velocity and swing, let an open-source model humanize it or offer four variations, describe a sound and get it, find any sound again by its vibe, arrange beats into a song, mix it through a real master chain, and export a WAV, or MIDI for your DAW.

```
 pads, keys --> zustand store --> scheduler -------> Tone.js engine --> speakers
 (tap, paint,   one Workspace,    pure timing math,  channels, reverb,
  velocity,     undo history      100 ms look-ahead  comp + limiter    same engine
  live REC)          |                                   |        --> Tone.Offline --> WAV
                     |--> Magenta.js (GrooVAE, MusicVAE, DrumRNN)   in the browser
                     |--> all-MiniLM-L6-v2 (384-d embeddings)       in the browser
                     |
                     '--> /api (Vercel) --> Tiger Data: Postgres + pgvector + full-text
                                       '--> ElevenLabs Sound Effects (server-side key)
```

### One thing up front, because it changes how you read every number below

Every number in this post was **measured**, and here is where:

- Audio and AI timings: **headless Chrome on a Windows laptop with no GPU**, against a local dev server. A laptop with a GPU will be faster. I haven't measured that, so I don't claim it.
- Database latency: **India to a Tiger Data service in US-East**. The deployed functions run in Vercel's `iad1`, next to the database.
- Search measurements used **synthetic test sounds** that the test script generated, uploaded and deleted again.
- Where something broke, the error is quoted **verbatim** in [What Didn't Work](#what-didnt-work).

### The walkthrough

You land on your workspaces. Each card's colour strip is the first six beat colours inside it.

![Pocket home: workspace cards with beat-colour strips](Blog%20images/01-home-workspaces.png)

A new workspace starts empty or from one of eight original patterns, each with its own tempo.

![New workspace dialog: Empty plus eight preset beats with BPM and a mini pad map](Blog%20images/02-new-workspace-presets.png)

Then the studio. Rack on the left, Beat Editor in the middle, Song underneath, Sounds and AI on the right.

![The full workspace: transport, Rack, Beat Editor, Song timeline and sound library](Blog%20images/05-workspace-overview.png)

The Rack rows *are* the Beat Editor's row headers. They're the same 44 px tall, and the pads stretch to fill whatever width you give them.

![Rack and Beat Editor: ten slots, sixteen steps, velocity shown as brightness](Blog%20images/06-rack-and-beat-editor.png)

Beats become a song by dragging them onto lanes. Dragging a clip's edge repeats the beat.

![Song timeline: Lo-fi, Drum & Bass and Boom Bap clips on three beat lanes](Blog%20images/07-song-arrangement.png)

Press **M** and the mixer slides up: a strip per sound, a reverb return, and a master with EQ, compressor, gain-reduction LEDs and a limiter.

![Mixer drawer: ten channel strips, reverb return and master section](Blog%20images/08-mixer.png)

And because it is built for one person, the Home page teaches it by hand, with live controls you can touch.

![Hand-lettered guide: eight steps from a blank page to a WAV](Blog%20images/03-guide-eight-steps.png)

![Know your controls: every control is live, plus a sticky note of shortcuts](Blog%20images/04-guide-know-your-controls.png)

## Demo

**Live:** https://krisp.vercel.app

[[VIDEO: 2–3 min, Anuv building a tune and exporting it. Paste with {% embed <url> %}]]

Saving and the sound library sit behind a studio passcode, because ElevenLabs credits cost money. The video shows them. Everything in the next list works without it.

### Verify this in 60 seconds, no keys, no clone

1. Open https://krisp.vercel.app → **New workspace** → **Lo-fi** → **Create**. If it asks for a passcode, click **Not now**. You can still make music; it just won't save.
2. Press **Space**.
3. Shift-click pads in the snare row. They cycle ghost → soft → normal → accent. Turn **Swing**.
4. **AI** tab → **Humanize**. The first run downloads the model. Then tiny dots appear inside the pads: that's microtiming.
5. **Export** → **WAV**.

### The check I would make if I were judging this

Drop that WAV into Audacity and zoom into the hi-hats. At 90 BPM with 50% swing, every second hat must land about **41 ms** late, and the even ones must not move.

When I ran exactly this against Pocket's own export, the odd hats landed **0.24 of a step** late (40 ms against the formula's 41.7 ms) and the even hats moved by less than 0.02 of a step. That is how you know the WAV is the same engine you were listening to, and not a re-implementation of it.

## Code

{% github Dronzer2code/Krisp %}

Created inside the challenge window (first commit 2026-10-03). Open-source work Pocket stands on is credited in the README: **Magenta.js**, **Tone.js**, **transformers.js** with **all-MiniLM-L6-v2**, **@tonejs/midi**, **pgvector**, and **Petaluma Script** for the hand-lettered guide.

### Run it yourself

```
git clone https://github.com/Dronzer2code/Krisp && cd Krisp
cp .env.example .env    # TIGER_DATABASE_URL, ELEVENLABS_API_KEY, APP_PASSCODE, DAILY_SOUND_LIMIT
npm install
# paste db/schema.sql into the Tiger Data SQL editor once
npx vercel dev          # app + /api on http://localhost:3000
npm run test            # 146 unit tests
npm run build && bash scripts/check-secrets.sh   # no key may appear in dist/
```

## How I Built It

### The architecture, actually explained

| Stage | Tech | Where it runs | What it does |
|---|---|---|---|
| 1 | zustand store | browser | One Workspace object, undo history; a whole knob drag is one undo step |
| 2 | Scheduler | browser | Pure timing math on Tone.js's Transport, 100 ms look-ahead |
| 3 | Audio engine | browser | Channels → reverb → master EQ → compressor → limiter → ceiling clipper |
| 4 | Magenta.js | browser | Humanize, Variations, Continue, Morph on the user's own beat |
| 5 | ElevenLabs | server | Text → one-shot or seamless loop |
| 6 | Tiger Data | server | Workspaces (JSONB), sounds + embeddings (pgvector), full-text, playlists |
| 7 | Entire | git | Agent sessions as checkpoints, linked to the commits they produced |

The rule behind every row: **anything musical happens in the browser and never waits on the network.** The network is for saving, the library, and making new sounds. Nothing else.

### Stage 2: the scheduler is three pure functions

A drum machine in a browser is a timing problem before it's anything else. All of Pocket's timing is three functions you can unit-test without a sound card:

```ts
export const stepSeconds = (bpm: number) => 60 / bpm / 4;

export function swingDelay(stepIndex: number, swing: number, stepSec: number) {
  return stepIndex % 2 === 1 ? (swing * stepSec) / 2 : 0;
}

export function hitTime(tickTime: number, stepIndex: number, step: { offset: number }, swing: number, stepSec: number) {
  const t = tickTime + swingDelay(stepIndex, swing, stepSec) + step.offset * stepSec;
  return Math.max(t, tickTime - 0.4 * stepSec); // a humanized hit may lead, never into the previous step
}
```

The Transport never loops. The loop region is applied by one more pure function, `wrapTick`, so drum hits and audio clips are triggered by the **same** per-tick code and can't drift apart.

### Stage 3: the export is not a second renderer

The obvious way to make a WAV is to write an offline renderer. That gives you two engines, and they will eventually disagree. `createEngine(context)` accepts *any* audio context, so the export opens a `Tone.Offline` context and runs the same graph and the same scheduler through it:

```ts
const rendered = await Tone.Offline(async (ctx) => {
  const engine = createEngine(ctx);     // identical graph: channels, reverb, master chain
  engine.sync(ws);
  await engine.ready;                    // reverb impulse response
  bindScheduler(ctx.transport, { getWorkspace: () => ws, trigger: engine.trigger /* … */ });
  ctx.transport.start(0);
}, seconds + 2, 2, 44100);
```

A 16-bar song at 90 BPM is 42.7 s of music. With a 2 s reverb tail, it rendered in **16.1 s** on that GPU-less laptop, about 2.7× faster than real time. It also followed the arrangement exactly: audio in bars 1–4, then RMS **0.000000** after.

![Export dialog: WAV through the full mixer, or MIDI on drum channel 10](Blog%20images/12-export.png)

### Stage 4: the AI never writes the beat for you

Most AI music tools generate the song. Pocket's AI only touches the beat you made, and every result is one undo away.

| Tool | Open checkpoint | What it is allowed to change |
|---|---|---|
| Humanize | `groovae_2bar_humanize`, trained on the Groove MIDI Dataset of real drummers | Velocity and timing of steps that are **already on**. It can't add or remove a note |
| Variations | `drums_2bar_lokl_small` | Four candidates near your beat; *wildness* sets similarity and temperature |
| Continue | `drum_kit_rnn` | Writes bar 2 from bar 1 |
| Morph | `drums_2bar_lokl_small` | Nine steps from one beat to another |

Before Humanize, every hit sits dead on the grid:

![Before Humanize: hits exactly on the grid](Blog%20images/16-ai-before-humanize.png)

After, the same hits, nothing added or removed. Velocities changed (brightness), and each dot is a microtiming offset the model put there:

![After Humanize: same steps, new velocities, microtiming dots inside the pads](Blog%20images/17-ai-after-humanize.png)

Variations are previewed by *holding* a candidate. It plays in place of your beat for as long as you hold it, without touching the beat or the undo history.

![Variations: four candidates, hold one to hear it, then Apply or Add as new beat](Blog%20images/18-ai-variations.png)

Two facts I only learned by running the models are now built into the converter:

- MusicVAE and DrumRNN return quantized notes with **velocity unset**. It reads as 0, so Pocket defaults it to 100.
- GrooVAE returns **unquantized** notes: a start time, not a step. Pocket recovers the step as `round(startTime / stepSeconds)` and keeps the remainder as an offset clamped to ±½ step. That remainder *is* the groove.

And one I had to design around: Snare and Clap share drum pitch 38. A model's snare notes would wipe out the clap row, so model notes go to the **first** slot with a pitch and the rest keep their own steps.

### Stage 5: ElevenLabs, the sound that isn't in any pack

Digging through sample packs is search over things that already exist. ElevenLabs makes the thing that doesn't. That's a different job, and it changes the workflow: the producer says what they hear, and the sound turns up on a pad.

![Create tab: the exact prompt sent to ElevenLabs is shown under the field, with today's remaining generations](Blog%20images/09-elevenlabs-create.png)

Pocket shapes the request and **shows you exactly what it sends**, so nothing is hidden behind a magic box:

```
ONE_SHOT  "<your words>, single drum one-shot, isolated, dry, no music"
LOOP      "<your words>, seamless drum loop, <bpm> bpm"        + loop: true

POST https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128
     xi-api-key: (server only)   { text, duration_seconds, prompt_influence: 0.5, loop }
```

#### Everything ElevenLabs is actually doing here

| Feature | Where | Why it's load-bearing |
|---|---|---|
| Sound Effects API | `api/sound-generate.ts` | The only way to get a sound that exists in no pack |
| `loop: true` | loop requests | Seamless loops that drop straight onto an AUDIO lane |
| `duration_seconds` 0.5–2 s | one-shots | Drum hits, not soundscapes |
| Server-side key | Vercel function | `scripts/check-secrets.sh` fails the build if a key leaks into `dist/` |
| Daily limit | `sound_usage` table | 40 credits per second of sound; the counter ("38 left today") keeps the demo alive through judging |

The two generated sounds in this library came back at **1.3 s** each. In the browser they are trimmed of silence, faded, peak-normalised to −1 dBFS, embedded, and filed next to uploads:

![Upload: drop your own WAV, MP3 or OGG up to 3 MB](Blog%20images/11-upload.png)

### Stage 6: Tiger Data, one Postgres with three kinds of memory

Producers search two ways. Sometimes it's a word: "808", "clap". Sometimes it's a feeling: "warm", "dusty", "like old vinyl". Keyword search fails the second; vector search fumbles the first. The usual answer is a Postgres *and* a vector database *and* glue code between them.

Tiger Data made that a non-problem. One service holds the workspaces as **JSONB**, the audio as **bytea**, the meaning as **pgvector** and the spelling as **tsvector**. The fusion is a single statement, reciprocal rank fusion with k = 60 (columns abridged):

```sql
WITH v AS (            -- meaning: cosine distance on all-MiniLM-L6-v2 embeddings made in the browser
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

Every result carries a **`vector`** badge, a **`keyword`** badge, or both, so you can see *why* a sound came up. In testing, *"dusty kick"* found the uploaded kick with both badges. *"warm lo-fi bass drum"* (words that were never its name) found it by vector, plus a keyword hit on its `warm` tag.

[[SCREENSHOT: Library search showing vector and keyword badges for two queries]]

The library is organised the way producers organise folders: **playlists**, where a sound can live in several at once, sit above everything still unsorted.

![Library: playlists above unsorted sounds, each with an options menu](Blog%20images/10-library-playlists.png)

This is the whole schema on Tiger Data, live:

![Tiger Data console: five Postgres tables — sounds, workspaces, playlist_sounds, playlists, sound_usage](Blog%20images/13-tiger-data-tables.png)

#### Everything Tiger Data is actually doing here

| Feature | Where | Why it's load-bearing |
|---|---|---|
| pgvector (`vector(384)`, HNSW cosine) | `sounds.embedding` | Search by vibe |
| Full-text (`tsvector`, GIN) | `sounds.tsv` | Search by exact word |
| One-statement RRF | `api/search.ts` | Both searches, one round trip, ranked together |
| JSONB | `workspaces.data` | A whole Workspace (rack, beats, song, mix) in one row |
| bytea | `sounds.audio` | Audio lives with its metadata. No second storage service |
| Two-table join | `playlists` + `playlist_sounds` | Folders where a sound can be in many |

### Stage 7: Entire, the build is reviewable too

A project built with an AI agent has a second artefact besides the code: the reasoning that produced it. Entire keeps it. We ran `entire enable --agent claude-code --import-history`. That installed Claude Code hooks, and it also **imported the session that had started before Entire was set up**, so nothing from the first hour was lost. Since then, every `git push origin` uploads the session checkpoints next to the commits they produced. The repository itself lives on Entire (`origin`), mirrored to GitHub for Vercel.

![Entire repository overview: 36 commits in the past month, split Claude Code and manual, two contributors](Blog%20images/14-entire-repo-overview.png)

Entire's own numbers for this repo: **36 commits**, **7 checkpoints**, **15 messages**, **591.3k tokens** (996 in, 590.3k out), about **84.5k tokens per checkpoint**.

![Entire analytics: checkpoints, throughput, messages and token usage over the build](Blog%20images/15-entire-analytics.png)

That is what made the "verbatim errors" table below possible. Every failure, and the reasoning that fixed it, is on record rather than reconstructed from memory.

#### Everything Entire is actually doing here

| Feature | Where | Why it's load-bearing |
|---|---|---|
| Claude Code hooks | `.claude/settings.json` | Sessions captured as they happen, no copy-pasting transcripts |
| `--import-history` | first setup | Recovered the session from before Entire existed in the repo |
| Checkpoints on `git push` | `entire://…/et/krisp/krisp` | Reasoning travels with the code |
| Analytics | Entire dashboard | Measurable build: commits, checkpoints, tokens |

## What My Friend Said

[[HANDOVER: what Anuv did on camera — the tune he made, what he exported, what he took into his DAW. Facts only.]]

> [[QUOTE: Anuv's own words, exactly as he said them]]

## Why Does Open Innovation Matter?

Four concrete reasons, each one measured or tested:

1. **The beat never leaves the device.** I ran the whole AI test suite with **every `/api` request blocked** in the browser. Humanize, Variations, Continue and Morph all passed.
2. **It costs nothing to run.** No per-request inference bill for the AI. The only metered call in Pocket is ElevenLabs, and it's explicit and capped per day.
3. **Open means inspectable.** I only found out that GrooVAE returns unquantized start times, and that the VAE leaves velocity at 0, *because* the checkpoints and the library are open. A closed API would have handed back a groove I couldn't explain.
4. **Once loaded, it is always there.** The cold cost is real: the drums VAE loaded in **14.2 s** and the first Humanize took **15 s**, both on a GPU-less machine. Both happen once. [[MEASURE: warm Humanize time on Anuv's laptop]]

### What this unlocks

The same pattern (a pure scheduler, one engine for live and offline, open models in the tab, one Postgres for meaning and spelling) works for any instrument, not just drums. A melodic step sequencer, a sample chopper or a practice metronome with real feel is a new rack, not a new architecture.

## What Didn't Work

### Hazards, with the errors verbatim

| What happened | The error | The fix |
|---|---|---|
| Postgres refused my search column | `generation expression is not immutable` | `array_to_string` isn't immutable, so `tsv` became a plain column that each INSERT fills |
| A new Tiger service failed TLS for over an hour | `SELF_SIGNED_CERT_IN_CHAIN` | The cert came from Tiger's own CA, `ca.timescale.com`. I trusted that CA **with verification on**, instead of `rejectUnauthorized: false` |
| Disabling the limiter crashed the mixer | `RangeError: Value must be within [-100, 0], got: 1e-7` | Tone ramps start from 1e-7 when a param is 0, so dynamics params are now set directly, not ramped |
| Solo didn't silence the other channels | no error: the kick still read **−32 dB** with the snare soloed | `Volume.mute` was undone by the next volume ramp. Mute is now its own gate stage |
| The limiter didn't limit | no error: on **+6.4 dBFS**, off **+7.2 dBFS** | WebAudio's compressor adds makeup gain and lets transients through; even a raw −12 dB / 20:1 left a 0 dB sine at −4.2 dBFS. A soft clipper now holds peaks at exactly **−6.0 dBFS** |
| TypeScript gave up on transformers.js | `Expression produces a union type that is too complex to represent.` | A typed wrapper around `pipeline()` |
| Vercel blocked deploys after a teammate's merge | status **Blocked** | Hobby only deploys private-repo commits authored by the owner. An owner-authored commit unblocked it |
| Saving felt slow in local dev | ~3 s per request | 2.16 s TLS connect + 0.26 s per query, India → US-East, new connection per request. Production sits next to the DB and keeps its pool |

### What's real and what's simplified

| Real | Simplified, on purpose |
|---|---|
| Magenta models running in the browser | The default kit is synthesised; your own sounds replace it |
| ElevenLabs generation, server-side | No time-stretching. A warning dot marks loops that don't fit the bar grid |
| pgvector + full-text hybrid search | A shared studio passcode instead of accounts; it's built for one person |
| The WAV export *is* the playback engine | 4/4 only, 16 or 32 steps |
| 146 unit tests + browser end-to-end checks | A daily generation cap to protect credits |

## My Agent Session

Pocket was built with Claude Code and captured with Entire (see Stage 7):

[[ENTIRE: session links: the engine and scheduler, the offline export, the hybrid search, the TLS fix]]

## Prize Categories

- **Best Use of ElevenLabs**: generated one-shots and seamless loops inside the workflow, with the exact prompt shown and a daily cap.
- **Best Use of Tiger Data**: one Postgres holding JSONB workspaces, bytea audio, pgvector meaning and full-text spelling, fused in a single SQL statement with visible match reasons.
- **Best Use of Entire**: the repository lives on Entire; every agent session is captured, imported from before setup, and linked to the commits it produced.

## Team

[[TEAM: Subarna Maity (@dronzer2code) · Sourish Panda (@[[DEV username]])]]

## References

- Magenta.js — https://github.com/magenta/magenta-js · Groove MIDI Dataset — https://magenta.tensorflow.org/datasets/groove
- ElevenLabs Sound Effects API — https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
- pgvector — https://github.com/pgvector/pgvector · Tiger Data — https://www.tigerdata.com
- Entire — https://docs.entire.io
- Tone.js — https://tonejs.github.io · transformers.js — https://github.com/huggingface/transformers.js

---

*Built within the challenge window by Subarna Maity and Sourish Panda with AI pair programming, captured on Entire. All preset beat patterns are original to this project. The sounds used in the search measurements were synthetic test tones, generated, uploaded and deleted by the test script. Anuv's name and words appear with his permission.* [[CONFIRM before publishing]]
