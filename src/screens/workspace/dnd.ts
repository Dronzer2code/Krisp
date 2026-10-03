// Drag-and-drop payload types shared by Beat chips, the Sound Browser and the Song.

export const BEAT_DRAG_TYPE = 'application/x-pocket-beat';
export const SOUND_DRAG_TYPE = 'application/x-pocket-sound';

export interface SoundDragPayload {
  id: string;
  name: string;
  kind: 'ONE_SHOT' | 'LOOP';
  durationMs: number;
}
