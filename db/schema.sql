CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ONE_SHOT','LOOP')),
  source text NOT NULL CHECK (source IN ('ELEVENLABS','UPLOAD')),
  prompt text,
  tags text[] NOT NULL DEFAULT '{}',
  mime text NOT NULL,
  duration_ms int NOT NULL,
  audio bytea NOT NULL,
  embedding vector(384) NOT NULL,
  -- VERIFY-6 fallback: Tiger rejects array_to_string in a generated column ("generation expression is not immutable").
  -- Every INSERT sets tsv = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(prompt,'') || ' ' || array_to_string(tags,' ')).
  tsv tsvector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sounds_embedding_idx ON sounds USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS sounds_tsv_idx ON sounds USING gin (tsv);
CREATE INDEX IF NOT EXISTS sounds_created_idx ON sounds (created_at DESC);

CREATE TABLE IF NOT EXISTS sound_usage (day date PRIMARY KEY, count int NOT NULL DEFAULT 0);

-- Library playlists (added 2026-10-04; also in db/migrations/002_playlists.sql)
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
