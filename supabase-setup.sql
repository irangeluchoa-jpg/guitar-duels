-- ================================================================
-- Guitar Duels — Setup Supabase
-- Execute este SQL no editor SQL do seu projeto Supabase
-- ================================================================

-- Tabela de scores globais (melhor score por jogador por música)
create table if not exists global_scores (
  id            bigserial primary key,
  player_name   text        not null,
  track_id      text        not null,
  song_name     text        not null,
  artist        text        not null default '',
  score         integer     not null default 0,
  accuracy      numeric(5,1) not null default 0,
  grade         text        not null default 'F',
  max_combo     integer     not null default 0,
  perfect       integer     not null default 0,
  great         integer     not null default 0,
  good          integer     not null default 0,
  miss          integer     not null default 0,
  is_fc         boolean     not null default false,
  created_at    timestamptz not null default now(),
  unique (player_name, track_id)
);

-- Tabela de scores do desafio diário
create table if not exists daily_scores (
  id            bigserial primary key,
  player_name   text        not null,
  track_id      text        not null,
  song_name     text        not null,
  artist        text        not null default '',
  score         integer     not null default 0,
  accuracy      numeric(5,1) not null default 0,
  grade         text        not null default 'F',
  max_combo     integer     not null default 0,
  is_fc         boolean     not null default false,
  day           date        not null,
  attempts      integer     not null default 1,
  created_at    timestamptz not null default now(),
  unique (player_name, day)
);

-- Índices para performance
create index if not exists idx_global_scores_track  on global_scores (track_id, score desc);
create index if not exists idx_global_scores_score  on global_scores (score desc);
create index if not exists idx_daily_scores_day     on daily_scores (day, score desc);

-- Row Level Security: leitura pública, escrita autenticada pelo anon key
alter table global_scores enable row level security;
alter table daily_scores  enable row level security;

-- Política: qualquer um pode ler
create policy "public read global"  on global_scores for select using (true);
create policy "public read daily"   on daily_scores  for select using (true);

-- Política: qualquer um pode inserir/atualizar (anon key)
create policy "anon insert global"  on global_scores for insert with check (true);
create policy "anon update global"  on global_scores for update using (true);
create policy "anon insert daily"   on daily_scores  for insert with check (true);
create policy "anon update daily"   on daily_scores  for update using (true);
