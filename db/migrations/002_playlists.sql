-- Library playlists (folders for Sounds). Additive and idempotent: safe to run more than once.
-- A Sound can be in several playlists; deleting a playlist keeps its Sounds; deleting a Sound removes it everywhere.

CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playlist_sounds (
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  sound_id uuid NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, sound_id)
);
CREATE INDEX IF NOT EXISTS playlist_sounds_sound_idx ON playlist_sounds (sound_id);
