-- ============================================================
--  Execute este SQL no Supabase SQL Editor
--  https://supabase.com/dashboard → seu projeto → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
  code        TEXT PRIMARY KEY,
  host_id     TEXT NOT NULL,
  song_id     TEXT,
  state       TEXT NOT NULL DEFAULT 'waiting',
  paused_by   TEXT,
  start_time  BIGINT,
  max_players INT  NOT NULL DEFAULT 4,
  players     JSONB NOT NULL DEFAULT '[]',
  created_at  BIGINT NOT NULL
);

-- Limpeza automática de salas antigas (mais de 2h)
-- Opcional: rode manualmente ou agende via pg_cron
-- DELETE FROM rooms WHERE created_at < (EXTRACT(EPOCH FROM NOW()) * 1000 - 7200000);

-- Permite acesso anon (necessário para a anon key funcionar)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_rooms" ON rooms
  FOR ALL
  USING (true)
  WITH CHECK (true);
