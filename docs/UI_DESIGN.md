# UI_DESIGN.md — Pocket

## PURPOSE

Defines Pocket's visual and interaction design: the minimal skeuomorphic style, design tokens, UI primitives with sizes and states, screen layouts, responsive behaviour, motion, accessibility, and UI copy.
Screens implement features from `docs/PRD.md`; component file names are in `docs/TRD.md` → REPOSITORY LAYOUT.

## CONTEXT

- Style: **minimal skeuomorphism** — Pocket looks like a calm, well-made piece of studio hardware. Controls feel physical (pads, knobs, faders, LEDs, an LCD), but the layout is sparse.
- One mode only. Every feature is reachable from the single Workspace screen.

## DESIGN PRINCIPLES

1. **Tactile, not ornamental.** Depth comes only from light/shadow on controls. No textures, wood, leather, or decorative gradients.
2. **Few surfaces.** One panel colour, two depths (raised, sunken). Content lives on panels; panels sit on the page background.
3. **Colour means something.** One accent (`--led-on`) for active state and values. Slot colours appear only on LEDs, pads and clips.
4. **Every control is labelled.** Small uppercase labels under or above controls.
5. **Music first.** The Beat Editor and Song always have the most space; Rack, Sounds, AI and Mixer are secondary.

## DESIGN TOKENS (`src/theme/tokens.css`)

```css
:root {
  /* surfaces */
  --bg: #D9D4C9;
  --panel: #E9E5DC;
  --panel-raised: #F2EFE8;
  --panel-sunken: #DCD7CC;
  --graphite: #2F3033;
  --graphite-2: #3A3B3F;
  /* ink */
  --ink: #2B2B2E;
  --ink-soft: #6E6A63;
  --ink-inverse: #F2EFE8;
  /* signals */
  --led-on: #FF6A00;
  --led-green: #3DDC84;
  --led-amber: #FFB020;
  --led-red: #FF3B30;
  --lcd-bg: #1E1F21;
  --lcd-text: #FF8A3D;
  /* depth */
  --shadow-raised: 6px 6px 14px rgba(0,0,0,.16), -5px -5px 12px rgba(255,255,255,.85);
  --shadow-pressed: inset 3px 3px 7px rgba(0,0,0,.18), inset -3px -3px 7px rgba(255,255,255,.7);
  --shadow-sunken: inset 2px 2px 5px rgba(0,0,0,.20), inset -2px -2px 5px rgba(255,255,255,.6);
  --hairline: 1px solid rgba(255,255,255,.7);
  /* shape */
  --r-lg: 18px; --r-md: 12px; --r-sm: 8px; --r-pad: 9px;
  /* type */
  --font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --label: 600 10px/1 var(--font-ui);       /* uppercase, letter-spacing .08em */
  --text: 400 13px/1.4 var(--font-ui);
  --title: 600 15px/1.2 var(--font-ui);
  /* spacing (4px grid) */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px;
  /* motion */
  --t-fast: 90ms; --t-base: 120ms; --ease: cubic-bezier(.2,.8,.2,1);
}
```

Fonts: Google Fonts `Inter` (400, 600) and `JetBrains Mono` (500) with fallbacks above. A dark theme is out of scope.

## PRIMITIVES (`src/ui/`)

Every primitive MUST support mouse, touch and keyboard, show a focus ring (`outline: 2px solid var(--led-on); outline-offset: 2px`), expose ARIA role/value, and accept `disabled`.

| Component | Size | Look | States | Interaction | ARIA |
|---|---|---|---|---|---|
| `Panel` | any | `--panel`, `--r-lg`, `--shadow-raised`, `--hairline` top edge; optional two 4px "screw" dots (`--panel-sunken` with inner shadow) in top corners | — | container | `region` with label |
| `Knob` | 36 px (sm 28 px) | circular cap `--panel-raised` with radial light from top-left, 2px indicator line `--ink`; 270° arc track in `--panel-sunken`, value arc in `--led-on`; 11 tick marks | idle, hover (cap lifts 1px), dragging (value tooltip in LCD style), disabled | vertical drag (150 px = full range), Shift = ×0.2, wheel, arrow keys (1%), PageUp/Down (10%), double-click = default | `slider`, `aria-valuemin/max/now/text` |
| `Fader` | 120–160 px track | sunken slot `--shadow-sunken`, cap 22×34 px raised with 3 grip lines, dB marks (+6, 0, −6, −12, −24, −48, −∞) | idle, dragging, disabled | drag, wheel, arrows (0.5 dB), double-click = 0 dB | `slider` vertical |
| `Pad` | 30–40 px square | rounded `--r-pad`, base `--graphite`; off: `--shadow-sunken`; on: fill = Slot colour, inner glow `0 0 12px` Slot colour at opacity = velocity/127; group of 4 separated by 6 px gap | off, on (4 velocity levels), playhead (lighter rim), pressed (translateY 1px), flash on hit (90 ms brighten) | click toggle, drag paint, Shift+click / long-press 400 ms velocity cycle, Space/Enter toggles when focused, arrow keys move focus | `button` with `aria-pressed`, label "Kick step 5, velocity 100" |
| `LedButton` | 28 px | raised square button with 6 px LED dot top-right; LED off = `#BDB7AC`, on = colour with `0 0 6px` glow | off, on, disabled | click, Space/Enter | `button aria-pressed` |
| `Lcd` | min 72×32 px | `--lcd-bg`, sunken, `--lcd-text` digits in `--font-display` 20px, faint 2px scanlines at 6% | idle, editing (caret) | drag vertical to change, click to type, Enter commits, Esc cancels | `spinbutton` |
| `Meter` | 6 px × 80–120 px | 16 LED segments: 11 green, 3 amber, 2 red; unlit segments `--panel-sunken`; peak-hold segment 1 s | — | display | `meter` |
| `Toggle` | 2-position, 64×26 px | sunken track, raised thumb, labels both sides | left/right | click, arrows | `switch` |
| `Chip` | 26 px tall | raised pill, colour dot + name | selected (pressed shadow + accent text) | click, context menu (right-click / long-press / Shift+F10) | `tab` within `tablist` |
| `Tabs` | 32 px | segmented sunken track with raised active segment | active | click, arrows | `tablist` |
| `Dialog` | max 480 px | Panel centred, backdrop rgba(40,38,34,.35) | — | Esc closes, focus trap | `dialog aria-modal` |
| `Tooltip` | — | small LCD-style label | — | hover/focus 400 ms | `tooltip` |

Icons: inline SVG, 1.5 px stroke, `--ink`, 16 px (play, stop, loop, record, undo, redo, plus, trash, upload, sparkle for AI, download). No icon library dependency.

## SCREENS

### Home (`screens/Home.tsx`)

- Background `--bg`. Header Panel: wordmark "POCKET" in `--font-display`, small subtitle "beat workspace".
- Grid of Workspace "cartridges": Panel cards 220×140 px: name (title), last edited (label), a 6-segment strip of Beat colours, ⋯ menu (Rename, Duplicate, Delete).
- First card is always **New workspace** (dashed sunken outline, large plus).
- Empty state: centred Panel "No workspaces yet — start one and hear a beat in seconds." + New workspace button.
- New workspace Dialog: name field; **Start from** — "Empty" plus 8 preset cards (genre, BPM, mini pad strip); Create button.

### Workspace (`screens/Workspace.tsx`), desktop ≥ 1200 px

```text
┌ Transport (Panel, 64 px) ──────────────────────────────────────────────────────────────┐
│ ← Home │ ▶ ■ ⟲ │ [BEAT|SONG] │ LCD 090.0 TAP │ SWING ◯ │ METRO ▢ │ 03.2.4  00:41 │ ↶ ↷ │ ● saved │ EXPORT │
├ Rack (Panel, 240 px) ┬ Main column ───────────────────────────────┬ Side (Panel, 320 px) ┤
│ ● Kick      ◯tune M S │ Beat chips [Beat 1][Beat 2][+][Insert preset]│ [SOUNDS | AI]        │
│ ● Snare     ◯tune M S │ Beat Editor (Panel): 8 rows × 16/32 pads     │                      │
│ …                     │ length 16/32 · clear · record                │                      │
│ + Add slot            ├──────────────────────────────────────────────┤                      │
│                       │ Song (Panel): ruler, lanes, clips, + lanes    │                      │
├───────────────────────┴──────────────────────────────────────────────┴──────────────────────┤
│ Mixer drawer (Panel, 260 px, toggled with M): [Kick][Snare]…[Audio 1] | [REVERB] | [MASTER] │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Region details:
- **Transport:** LED states: play LED green while playing; save LED per PROCESS_FLOW; Export opens ExportDialog.
- **Rack row** (44 px): LED dot (Slot colour, flashes on hit), name (double-click rename), sound name in `--ink-soft` (click → Sounds panel in replace mode), Preview pad (24 px), Tune knob (sm), M and S LedButtons, ⋯ (Recolor, Remove).
- **Beat Editor:** rows align with Rack rows (same 44 px height, same order) so the Rack acts as the row header. Step numbers 1–16 above pads in label style; beat groups visually separated. Velocity shown by glow intensity; microtiming offset shown as a 3 px tick inside the pad shifted left/right.
- **Song:** ruler (bar numbers, loop region as a translucent `--led-on` band), lanes 52 px tall with a header (name, type icon, ⋯). Beat clips: rounded rectangles in Beat colour at 85% opacity with a mini pad map; audio clips: `--graphite-2` with waveform in `--ink-inverse` and a warning dot when length mismatches. Selected clip: 2px `--led-on` outline. Playhead: 2px `--led-on` vertical line.
- **Side panel — Sounds:** Tabs Presets | Create | Upload | Library. Rows 48 px: preview LedButton, name, kind/source badges, duration (LCD style small), waveform thumbnail (canvas 80×24), **Use**.
- **Side panel — AI:** four tool cards (Humanize, Variations, Continue, Morph), each a small Panel with model LED (off/amber/green/red), one-sentence description, controls (Wildness knob; Morph A/B selectors + slider), action button. Variations results: 2×2 grid of mini pad maps; hold to audition; Apply / Add as new beat.
- **Mixer:** channel strip 72 px wide: name + colour LED, EQ knobs (H/M/L, sm), Send knob, Pan knob, Meter beside Fader, M/S LedButtons. Master strip 140 px: EQ, Compressor block (ON LED, threshold, ratio, attack, release knobs, GR LED row), Limiter block (ON LED, ceiling knob), Reverb (decay, return), stereo Meter, Fader.

### Responsive

- 900–1199 px: Rack collapses to a 56 px column of LED dots + names on hover; Side panel becomes a slide-over from the right (button in Transport).
- < 900 px (tablet/phone): Transport wraps into two rows; Rack and Side panel are slide-over sheets; Beat Editor pads scroll horizontally in 32-step mode; Song lanes scroll horizontally; Mixer drawer scrolls horizontally. Minimum touch target 32 px.

## MOTION

- Press: `transform: translateY(1px)` + `--shadow-pressed`, `--t-fast`.
- LED on/off: opacity + glow, `--t-base`.
- Pad hit flash: 90 ms brighten then decay.
- Drawer/sheets: slide 180 ms `--ease`.
- `prefers-reduced-motion: reduce` → disable slides and flashes (keep state changes).

## ACCESSIBILITY

- WCAG AA contrast for text and labels on `--panel` (verify `--ink-soft` ≥ 4.5:1; darken if needed).
- Full keyboard path: Tab order Transport → Rack → Beat chips → Grid → Song → Side panel → Mixer.
- Grid: roving tabindex; arrows move between pads; Space toggles; Shift+Space cycles velocity.
- Live region announces: "Playing", "Stopped", "Saved", "Sound generated: <name>", AI results.

## KEYBOARD SHORTCUTS

| Key | Action |
|---|---|
| Space | Play / Stop |
| Enter | Return to start |
| L | Loop on/off |
| B / S | Play mode BEAT / SONG (when focus not in a text field) |
| M | Mixer drawer |
| T | Tap tempo |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo, Redo |
| Delete / Backspace | Delete selected clip |
| Ctrl/Cmd+D | Duplicate selected clip |
| A S D F G H J K | Live record Slots 1–8 (when Record is on) |
| ? | Shortcuts overlay |

Precedence: single-key shortcuts are ignored while a text field is focused. When Record is on, keys A–K go to live record and override S (Play mode SONG).

## UI COPY

- Tone: short, friendly, producer vocabulary. Sentence case for text; uppercase for control labels.
- Buttons: "New workspace", "Insert preset", "Add slot", "Generate", "Use", "Apply", "Add as new beat", "Export".
- Create hint: "Describe the sound — e.g. ‘dusty vinyl kick, warm, short tail’."
- Daily limit: "You’ve used today’s sound generations. Presets and uploads still work."
- Empty Song: "Drag a beat here to start your tune."
- Empty Library: "No sounds yet. Create one or upload your own."
- Passcode: "Enter the studio passcode to save and use the sound library."

## RELATED DOCUMENTS

`docs/PRD.md` (features), `docs/TRD.md` (components and state), `docs/PROCESS_FLOW.md` (journeys).
