import { useRef } from 'react';
import { restart, togglePlay } from '../../audio/context';
import { usePlayhead } from '../../audio/playhead';
import { formatClock, formatPosition, tapTempo } from '../../model/time';
import { BPM_MAX, BPM_MIN, SWING_MAX } from '../../model/types';
import { navigate } from '../../router';
import { useUi } from '../../store/ui';
import { actions, canRedo, canUndo, useWorkspace } from '../../store/workspace';
import { BackIcon, DownloadIcon, LoopIcon, MixerIcon, PlayIcon, RedoIcon, ReturnIcon, SparkleIcon, StopIcon, UndoIcon } from '../../ui/icons';
import { Knob } from '../../ui/Knob';
import { Lcd } from '../../ui/Lcd';
import { Led, LedButton } from '../../ui/LedButton';
import { Toggle } from '../../ui/Toggle';
import { Tooltip } from '../../ui/Tooltip';

// docs/UI_DESIGN.md → Workspace → Transport. 64 px Panel; wraps into two rows below 900 px.

const SAVE_LED = { saved: 'var(--led-green)', dirty: 'var(--led-amber)', saving: 'var(--led-amber)', error: 'var(--led-red)' } as const;
const SAVE_TEXT = { saved: 'saved', dirty: 'saving', saving: 'saving', error: 'not saved' } as const;

let taps: number[] = [];
export function tap() {
  const r = tapTempo(taps, performance.now());
  taps = r.taps;
  if (r.bpm !== null) actions.setBpm('push', r.bpm);
}

function Position() {
  const tick = usePlayhead((s) => s.tick);
  const seconds = usePlayhead((s) => s.seconds);
  return (
    <div className="lcd lcd-sm flex h-8 items-center gap-s3 px-s3" role="status" aria-label="Position">
      <span>{formatPosition(tick)}</span>
      <span className="opacity-70">{formatClock(seconds)}</span>
    </div>
  );
}

function PlayButton() {
  const playing = usePlayhead((s) => s.playing);
  return (
    <LedButton label={playing ? 'Stop (Space)' : 'Play (Space)'} toggle={false} on={playing} color="var(--led-green)" size={32} onClick={() => void togglePlay()}>
      {playing ? <StopIcon /> : <PlayIcon />}
    </LedButton>
  );
}

export function TransportBar() {
  const bpm = useWorkspace((s) => s.workspace.bpm);
  const swing = useWorkspace((s) => s.workspace.swing);
  const mode = useWorkspace((s) => s.workspace.playMode);
  const metronome = useWorkspace((s) => s.workspace.metronome);
  const loop = useWorkspace((s) => s.workspace.loop.enabled);
  const undoable = useWorkspace(canUndo);
  const redoable = useWorkspace(canRedo);
  const saveStatus = useUi((s) => s.saveStatus);
  const saveError = useUi((s) => s.saveError);
  const mixerOpen = useUi((s) => s.mixerOpen);
  const sideOpen = useUi((s) => s.sideOpen);
  const tapRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="panel flex min-h-16 flex-wrap items-center gap-x-s4 gap-y-s2 px-s4 py-s3" aria-label="Transport">
      <Tooltip text="Home" side="bottom">
        <button className="icon-btn" aria-label="Home" onClick={() => navigate('/')}><BackIcon /></button>
      </Tooltip>

      <div className="flex items-center gap-s2">
        <PlayButton />
        <LedButton label="Return to start (Enter)" toggle={false} size={32} onClick={() => void restart()}><ReturnIcon /></LedButton>
        <LedButton label="Loop region (L)" on={loop} size={32} onClick={() => actions.setLoop({ enabled: !loop })}><LoopIcon /></LedButton>
      </div>

      <Toggle label="Play mode" left="BEAT" right="SONG" value={mode} onChange={(m) => actions.setPlayMode(m)} />

      <div className="flex items-center gap-s2">
        <span className="label">BPM</span>
        <Lcd label="Tempo (BPM)" value={bpm} min={BPM_MIN} max={BPM_MAX} step={0.1} format={(v) => v.toFixed(1).padStart(5, '0')}
          onChange={(v) => actions.setBpm('gesture', v)} onChangeEnd={actions.endGesture} />
        <button ref={tapRef} className="btn h-8 px-s3" aria-label="Tap tempo (T)" onClick={tap}>TAP</button>
      </div>

      <Knob label="Swing" size="sm" value={swing} min={0} max={SWING_MAX} defaultValue={0}
        format={(v) => `${Math.round((v / SWING_MAX) * 100)}%`}
        onChange={(v) => actions.setSwing('gesture', v)} onChangeEnd={actions.endGesture} />

      <LedButton label="Metronome" on={metronome} wide onClick={() => actions.setMetronome(!metronome)}>METRO</LedButton>

      <Position />

      <div className="flex items-center">
        <Tooltip text="Undo (Ctrl+Z)" side="bottom">
          <button className="icon-btn" aria-label="Undo" disabled={!undoable} onClick={actions.undo}><UndoIcon /></button>
        </Tooltip>
        <Tooltip text="Redo (Ctrl+Shift+Z)" side="bottom">
          <button className="icon-btn" aria-label="Redo" disabled={!redoable} onClick={actions.redo}><RedoIcon /></button>
        </Tooltip>
      </div>

      <Tooltip text={saveError ?? (saveStatus === 'saved' ? 'All changes saved' : 'Saving…')} side="bottom">
        <span tabIndex={0} className="flex items-center gap-s2" role="status" aria-label={`Save status: ${SAVE_TEXT[saveStatus]}`}>
          <Led color={SAVE_LED[saveStatus]} />
          <span className="label">{SAVE_TEXT[saveStatus]}</span>
        </span>
      </Tooltip>

      <div className="ml-auto flex items-center gap-s2">
        <LedButton label="Mixer (M)" on={mixerOpen} wide onClick={() => useUi.getState().set({ mixerOpen: !mixerOpen })}>
          <MixerIcon /> MIXER
        </LedButton>
        <LedButton label="Sounds and AI" on={sideOpen} wide className="wide:hidden" onClick={() => useUi.getState().set({ sideOpen: !sideOpen })}>
          <SparkleIcon /> PANEL
        </LedButton>
        <button className="btn" onClick={() => useUi.getState().set({ exportOpen: true })}><DownloadIcon /> Export</button>
      </div>
    </header>
  );
}
