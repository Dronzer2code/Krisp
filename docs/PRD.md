# PRD.md — Pocket

## PURPOSE

Defines WHAT Pocket is, WHY it exists, WHO it serves and WHAT each feature must do from the user's point of view.
Minimum scope and acceptance criteria: `docs/MVP.md`. Implementation: `docs/TRD.md`. Journeys and flows: `docs/PROCESS_FLOW.md`. Visual design: `docs/UI_DESIGN.md`.

## CONTEXT

### Competition

- DEV "Hacktoberfest Weekend Challenge: Build for a Friend" (Hacktoberfest 2026, challenge 1 of 5).
- Prompt: build something with **open-source AI at its core** (open-weight model, open-source framework, or local inference) and explain why open innovation matters for it.
- Theme: solve a real problem for one real friend. Bonus: hand it over and report the reaction.
- Judging, heaviest first: Writing Quality, Relevance to Prompt and Theme, Creativity, Technical Execution, Use of Partner Technology.
- Deadline: 2026-10-05T06:59:00Z. One submission can enter every partner category it genuinely uses; it can win once.

### Prize categories targeted

| Category | Prize | How Pocket qualifies |
|---|---|---|
| Best Use of ElevenLabs | $100 | Sound Effects API generates the friend's custom one-shots and loops inside the workflow |
| Best Use of Tiger Data | $100 | pgvector + keyword hybrid search over the sound library; Workspaces stored in Postgres |
| Best Use of Entire | $100 | Agent sessions that built Pocket are shared in the write-up |
| Overall | $250 | Story, writing, execution |

### Differentiation (submissions checked 2026-10-03)

Crowded areas to avoid: recipes from voice memos, language practice, medicine schedules, expense tracking, study tools, task-paralysis coaches, accessibility checkers, voice generation for narration. No submission found for a beat-making workspace. Plain web drum machines exist outside the challenge; Pocket differs through: a full workspace (Beats → Song → Mixer → Export) in one calm hardware-style UI, open-source AI acting on the user's own beats, custom sound creation with ElevenLabs, and a searchable personal sound library.

## PROBLEM

The friend is a beat producer who uses a desktop DAW (which DAW: UNKNOWN).

1. Ideas arrive away from the DAW; phone/web tools are either toys (one loop, no arrangement, no mixing) or bloated.
2. Starting from an empty grid is slow; he wants a starting point he can then shape by hand.
3. He spends a long time digging sample packs for one specific sound.
4. His sounds and sketches are scattered; nothing searchable.

## USERS

| User | Description |
|---|---|
| Producer (primary, the friend) | Builds beats and short tunes, mixes them, exports to his DAW or shares a WAV. Comfortable with DAW concepts (steps, BPM, mixer, master). |

Single-user product. No accounts. A passcode protects the backend (F11).

## GOALS

- G1: From opening the app to hearing a beat in under 10 seconds (preset or a few taps).
- G2: Build a full multi-beat tune with arrangement, mixing and mastering without leaving the browser.
- G3: Create a specific sound by describing it, and find any sound later by describing it.
- G4: Keep the AI as a helper on the user's own beats, never a replacement for manual creation.
- G5: Hand off to the DAW via MIDI and WAV.

## NON-GOALS

- Melodic instruments, piano roll, synth design, audio recording from microphone, time-stretching, effects plugins beyond the listed mixer/master, collaboration, user accounts, mobile native apps, basic/advanced modes.

## CORE CONCEPTS

These names MUST be used in code, UI and all docs.

| Concept | Definition |
|---|---|
| **Workspace** | A project: tempo, swing, Rack, Beats, Song, Mixer. Listed on Home. |
| **Rack** | The Workspace's ordered list of Slots (instruments). |
| **Slot** | One instrument: a name, color, and one Sound (preset synth or a library one-shot), plus tune. Has its own Channel. |
| **Beat** | A step pattern of 16 or 32 sixteenth-note steps across all Slots. A Workspace has many Beats. |
| **Song** | The Workspace timeline, measured in bars (4/4). |
| **Lane** | A Song row. `BEAT` lanes hold Beat clips; `AUDIO` lanes hold audio clips. AUDIO lanes have their own Channel. |
| **Clip** | An item on a Lane: a Beat clip (repeats its Beat to fill its length) or an audio clip (plays a LOOP Sound). |
| **Sound** | A library audio file. Kind `ONE_SHOT` or `LOOP`; source `ELEVENLABS` or `UPLOAD`. Preset synth sounds are not library Sounds. |
| **Mixer** | All Channels + Reverb return + Master. |
| **Channel** | Volume, pan, mute, solo, 3-band EQ, reverb send, meter. |
| **Master** | Final bus: EQ, compressor, limiter, reverb settings, volume, meter. |
| **Play mode** | `BEAT` (loop the selected Beat) or `SONG` (play the timeline). |

## FEATURES

Feature IDs are stable. Priority per feature is defined in `docs/MVP.md`.

### F1 Home and Workspaces
The user sees all Workspaces as cards and can create (empty or from a preset Beat), open, rename, duplicate and delete them. Changes save automatically with a visible save status.

### F2 Transport
Play/stop, return to start, loop a bar range, switch Play mode, set BPM (drag, type, tap tempo), swing, metronome, see position (bar.beat.step and mm:ss), undo/redo every edit.

### F3 Rack
The user sees the Workspace's Slots, previews each sound, renames, recolors (from palette), tunes (±12 semitones), mutes/solos, removes, adds a Slot, or replaces a Slot's sound from the Sound Browser. New Workspaces start with an 8-Slot default kit (Kick, Snare, Clap, Closed Hat, Open Hat, Tom, Rim, Crash).

### F4 Beat Editor (manual creation — core)
The user programs the selected Beat by hand on pads: toggle, drag-paint, per-step velocity (ghost/soft/normal/accent), 16/32 length, clear row/beat. Beats are managed as chips: new, duplicate, rename, delete, insert preset. Live record from the keyboard (SHOULD).

### F5 Song
The user arranges Beat clips and audio loop clips on Lanes snapped to bars: place by drag, move, resize (Beat clips repeat), duplicate, delete, select. Lanes can be added, renamed, deleted, reordered. Clips show previews (step mini-map or waveform). A loop region can be set on the ruler.

### F6 Sound Browser
One place for sounds with four tabs: **Presets** (synth kit), **Create** (ElevenLabs one-shot or loop from a text description), **Upload** (own one-shots/loops), **Library** (all saved Sounds with search). Any Sound can be previewed and used: assigned to a Slot (one-shots) or placed on an AUDIO lane (loops).

### F7 Hybrid search
Describing a sound ("warm dusty kick", "808") finds it using vector similarity and keyword match together; each result shows which matched.

### F8 Mixer
A drawer with a Channel strip per Slot and per AUDIO lane, a Reverb return and the Master strip (EQ, compressor with gain-reduction LED, limiter, reverb decay/return, volume). LED meters everywhere. Solo works like in DAWs.

### F9 AI tools (open source, in browser)
Act on the selected Beat: **Humanize** (adds human velocity/timing), **Variations** (4 candidates near the current Beat, with a "wildness" control; apply or add as new Beat), **Continue** (generate bar 2 from bar 1), **Morph** (blend Beat A → Beat B in steps; add as new Beat). Every AI action is undoable.

### F10 Export
WAV mixdown of the Song or loop region through the full Mixer; MIDI of the selected Beat or of the Song's Beat clips.

### F11 Passcode gate
Backend actions (save, upload, generate, search) require a passcode entered once per browser session. Beat making, mixing and AI work without it.

### F12 Shortcuts overlay
`?` shows all keyboard shortcuts.

## SUCCESS METRICS

| ID | Metric | Target |
|---|---|---|
| M1 | Time from Home to hearing a beat | < 10 s |
| M2 | Friend builds a ≥ 16-bar tune with ≥ 3 Beats, ≥ 1 custom Sound, mixing, export | Done on camera during handover |
| M3 | Playback timing | No audible drift over 64 bars at 140 BPM |
| M4 | Search | Generated sound found by a keyword query and by a descriptive query |
| M5 | Friend's verdict | Quote collected for the post |

## WHY OPEN INNOVATION MATTERS (product position)

- The music AI (Magenta, open source, trained on the open Groove MIDI Dataset of real drummers) and the embedding model (all-MiniLM-L6-v2) run **in the friend's browser**: his beats are never sent to an AI server, inference costs nothing, and it keeps working when servers are slow.
- Open models are swappable and inspectable; the team can choose checkpoints and see exactly what they do.
- ElevenLabs (closed) is used only for sound creation, an explicit, optional step.

## RISKS

| Risk | Impact | Mitigation |
|---|---|---|
| Magenta.js incompatible with Vite build | No AI features | First-hour smoke test; UMD script fallback |
| Audio timing drift / glitches | Poor demo | Tone.Transport scheduling with look-ahead; scheduler tests |
| ElevenLabs credits run out | No new sounds | Daily limit; cache every result; presets + upload still work |
| Scope too large for 24 h | Unfinished | Strict cut-line in `docs/MVP.md` |
| Free hosting cold starts | Slow first save/search | Frontend works offline-first for creation; backend only for library/save |

## RELATED DOCUMENTS

`docs/MVP.md`, `docs/TRD.md`, `docs/PROCESS_FLOW.md`, `docs/UI_DESIGN.md`, `docs/SUBMISSION.md`.
