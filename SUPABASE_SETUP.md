# Supabase — Setup do Multiplayer

## SQL para rodar no Supabase (SQL Editor → New Query → Run)

```sql
CREATE TABLE rooms (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  host_id     TEXT NOT NULL,
  song_id     TEXT,
  state       TEXT NOT NULL DEFAULT 'waiting',
  paused_by   TEXT,
  start_time  BIGINT,
  max_players INT NOT NULL DEFAULT 4,
  players     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX rooms_code_idx ON rooms (code);

-- Remove salas antigas automaticamente (após 3h)
CREATE OR REPLACE FUNCTION delete_old_rooms()
RETURNS void AS $$
  DELETE FROM rooms WHERE created_at < NOW() - INTERVAL '3 hours';
$$ LANGUAGE sql;

-- Acesso público
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON rooms FOR ALL USING (true) WITH CHECK (true);
```

## Variáveis de ambiente no Render

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_GITHUB_SONGS_REPO=irangeluchoa-jpg/guitar-duels-songs
NEXT_PUBLIC_GITHUB_SONGS_BRANCH=main
NEXT_PUBLIC_SITE_URL=https://seu-app.onrender.com
```
