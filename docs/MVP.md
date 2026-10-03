# MVP.md — Pocket

## PURPOSE

Defines the minimum Pocket that MUST ship before 2026-10-05T06:59:00Z: priority of every feature item, acceptance criteria, the demo scenario, and the cut-line.
Feature definitions: `docs/PRD.md` (F1–F12). Implementation: `docs/TRD.md`.

## CONTEXT

- Team: 2 people, ~24 hours of build time. Code freeze 2026-10-04T23:00:00Z; the remaining time is for handover, video and write-up (writing quality is the heaviest judging criterion).
- MUST items form the product the judges see. SHOULD items are built only after every MUST passes. MAY items only after every SHOULD.

## SCOPE BY PRIORITY

| Feature | MUST | SHOULD | MAY |
|---|---|---|---|
| F1 Home & Workspaces | List, create (empty / from preset), open, rename, delete, autosave + status LED | Duplicate | Mini color strip on cards |
| F2 Transport | Play/stop, return to start, BEAT/SONG mode, BPM (drag/type/tap), swing, position display, undo/redo | Loop region, metronome | Count-in |
| F3 Rack | Default 8-Slot kit, preview, rename, tune, mute/solo, add slot, replace sound, remove | Recolor | Reorder slots |
| F4 Beat Editor | Toggle, drag-paint, velocity cycling, 16/32, clear row/beat, beat chips (new/duplicate/rename/delete/insert preset), playhead | Live record (A–K keys) | Copy bar 1 → bar 2 button |
| F5 Song | BEAT and AUDIO lanes, place by drag, move, resize (repeat), delete, previews, SONG playback | Duplicate clip, lane rename/delete, auto-extend | Multi-select, lane reorder, zoom |
| F6 Sound Browser | Presets, Create (ElevenLabs), Upload, Library, Use (assign / place) | Waveform thumbnails | Tag editing after save |
| F7 Hybrid search | Search with vector/keyword badges | Kind filter | — |
| F8 Mixer | Channel volume/pan/mute/solo/meter, reverb send, Master compressor + limiter + volume + meter | Channel EQ, Master EQ, GR LED | Peak-hold |
| F9 AI | Humanize, Variations | Continue, Morph | Tap2Drum |
| F10 Export | WAV mixdown | MIDI | Stems |
| F11 Passcode | Gate + header + 401 | — | — |
| F12 Shortcuts overlay | — | — | Yes |

## ACCEPTANCE CRITERIA

Each MUST criterion has to be demonstrable on the deployed URL.

### F1
- AC-F1.1 Creating a Workspace from preset "Boom Bap" opens it with the preset Beat selected and BPM/swing applied; pressing Space plays it. (MUST)
- AC-F1.2 After any edit, the save LED goes amber then green within 3 s; refreshing the page restores the Workspace exactly. (MUST)
- AC-F1.3 Deleting asks for confirmation and removes the card. (MUST)

### F2
- AC-F2.1 Tap tempo: four taps 0.5 s apart set BPM to 120 ± 1. (MUST)
- AC-F2.2 Swing 50% audibly delays every second 16th; 0% is straight. (MUST)
- AC-F2.3 Undo reverts the last edit of any kind (pad, clip, mixer, AI); redo re-applies. (MUST)
- AC-F2.4 SONG mode plays the timeline; BEAT mode loops the selected Beat. (MUST)

### F3
- AC-F3.1 New Workspace has 8 Slots in default order; each preview plays its sound. (MUST)
- AC-F3.2 Replacing the Kick Slot's sound with a library one-shot changes playback immediately. (MUST)
- AC-F3.3 Tune +12 on a Slot raises its pitch by an octave. (MUST)

### F4
- AC-F4.1 A user can program a beat on all 8 Slots using only clicks and drags. (MUST)
- AC-F4.2 Shift+click cycles velocity 100 → 127 → 40 → 80; pad brightness changes; loudness changes audibly. (MUST)
- AC-F4.3 Switching 16 → 32 copies bar 1 into bar 2. (MUST)
- AC-F4.4 Insert preset adds a new Beat chip without altering existing Beats. (MUST)

### F5
- AC-F5.1 Dragging three different Beat chips onto BEAT lanes and one loop onto an AUDIO lane, then playing in SONG mode, follows the arrangement bar-accurately. (MUST)
- AC-F5.2 Resizing a 1-bar Beat clip to 4 bars repeats the Beat 4 times. (MUST)
- AC-F5.3 Deleting a Beat that is used by clips asks for confirmation and removes those clips. (MUST)

### F6
- AC-F6.1 Create: "dusty vinyl kick", One-shot, 1 s → a Sound appears in the Library, previews, and can be assigned to a Slot. (MUST)
- AC-F6.2 Upload a 3 s WAV → suggested kind LOOP; placing it on an AUDIO lane plays it in SONG mode. (MUST)
- AC-F6.3 Daily limit reached → Create shows a clear message and disables Generate. (MUST)

### F7
- AC-F7.1 Query "dusty kick" returns the Sound from AC-F6.1 with a keyword badge; query "warm lo-fi bass drum" returns it with a vector badge. (MUST)

### F8
- AC-F8.1 Soloing one Channel silences all non-soloed Channels. (MUST)
- AC-F8.2 Toggling the Master limiter on a loud mix audibly changes output; meters move with audio. (MUST)
- AC-F8.3 Reverb send on the Snare Channel adds audible reverb. (MUST)

### F9
- AC-F9.1 Humanize keeps the same active steps and changes velocity/timing. (MUST)
- AC-F9.2 Variations shows 4 candidate Beats; applying one changes the Beat; undo restores it. (MUST)
- AC-F9.3 AI tools work with no network access to the backend (models load from public checkpoint storage once). (MUST)

### F10
- AC-F10.1 WAV export of a 16-bar Song plays in an external player and matches in-app playback (arrangement, mixer, master). (MUST)
- AC-F10.2 MIDI export of a Beat imports into a DAW/online MIDI viewer with correct tempo and drum notes. (SHOULD)

### F11
- AC-F11.1 `/api/*` returns 401 without a correct `x-app-passcode`. (MUST)
- AC-F11.2 The frontend bundle contains no API keys. (MUST)

## DEMO SCENARIO (the video; MVP MUST support it end to end)

1. Home → **New workspace** "For <friend>" from preset **Lo-fi**. Space → it plays.
2. In the Beat Editor, add ghost snares by hand (Shift+click), adjust swing.
3. **Humanize** → feel changes. **Variations** → pick one → **Add as new beat**.
4. Sound Browser → **Create** "dusty vinyl kick, warm, short" → assign to Kick Slot.
5. **Upload** the friend's own loop → place on an AUDIO lane.
6. Song: arrange intro (Beat A, 4 bars) → main (Beat B, 8 bars, with loop) → outro (Beat A, 4 bars).
7. Mixer: reverb send on snare, Master compressor + limiter on.
8. **Export WAV**; friend opens it / drops MIDI into his DAW. Reaction recorded.

## CUT-LINE

Cut in this order when behind (first item cut first):

1. All MAY items
2. F12, live record, metronome, loop region
3. Morph, Continue
4. MIDI export
5. Channel EQ, Master EQ, GR LED, waveform thumbnails
6. Clip duplicate, lane rename/delete

NEVER cut: F1 MUST, F2 MUST, F3 MUST, F4 MUST, F5 MUST, F6 MUST, F7 MUST, F8 MUST, F9 Humanize + Variations, F10 WAV, F11.

## RELATED DOCUMENTS

`docs/PRD.md` (features), `docs/TRD.md` (how), `docs/TASKS.md` (when), `docs/SUBMISSION.md` (evidence per AC).
