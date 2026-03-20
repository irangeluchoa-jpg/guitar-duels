-- =============================================================================
-- GUITAR DUELS — Supabase Storage para fotos de perfil
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- =============================================================================

-- 1. Criar bucket "avatars" (público para leitura, autenticado para escrita)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                          -- público: qualquer um pode VER as fotos
  2097152,                       -- limite: 2 MB por foto
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- =============================================================================
-- 2. Policies de Storage (usando anon key, sem autenticação obrigatória)
-- =============================================================================

-- Remover policies antigas se existirem
drop policy if exists "avatars_public_read"   on storage.objects;
drop policy if exists "avatars_anon_upload"   on storage.objects;
drop policy if exists "avatars_anon_update"   on storage.objects;
drop policy if exists "avatars_anon_delete"   on storage.objects;
drop policy if exists "avatars_anon_list"     on storage.objects;

-- Qualquer pessoa pode LER fotos de perfil (necessário para mostrar nos rankings)
create policy "avatars_public_read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Qualquer pessoa pode FAZER UPLOAD (sem autenticação — usa playerId como nome do arquivo)
create policy "avatars_anon_upload"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );

-- Qualquer pessoa pode ATUALIZAR (upsert / troca de foto)
create policy "avatars_anon_update"
  on storage.objects for update
  using ( bucket_id = 'avatars' );

-- Qualquer pessoa pode DELETAR (necessário para remover fotos antigas ao trocar)
create policy "avatars_anon_delete"
  on storage.objects for delete
  using ( bucket_id = 'avatars' );

-- Qualquer pessoa pode LISTAR arquivos do bucket (para encontrar e deletar foto antiga)
create policy "avatars_anon_list"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- =============================================================================
-- 3. Tabela de referência de avatars (opcional mas recomendado)
--    Armazena qual é a URL atual de cada jogador para fácil consulta
-- =============================================================================

create table if not exists public.player_avatars (
  player_id   text        primary key,   -- sessionStorage playerId
  avatar_url  text        not null,      -- URL pública completa do Supabase Storage
  updated_at  timestamptz default now()
);

-- Qualquer um pode ler, criar e atualizar (sem auth)
alter table public.player_avatars enable row level security;

drop policy if exists "player_avatars_read"   on public.player_avatars;
drop policy if exists "player_avatars_upsert" on public.player_avatars;
drop policy if exists "player_avatars_delete" on public.player_avatars;

create policy "player_avatars_read"
  on public.player_avatars for select
  using (true);

create policy "player_avatars_upsert"
  on public.player_avatars for insert
  with check (true);

create policy "player_avatars_update"
  on public.player_avatars for update
  using (true);

create policy "player_avatars_delete"
  on public.player_avatars for delete
  using (true);

-- Índice para busca rápida por player_id
create index if not exists idx_player_avatars_player_id on public.player_avatars(player_id);

-- =============================================================================
-- 4. Verificação — rodar após executar para confirmar que tudo está OK
-- =============================================================================

select 'bucket' as tipo, id as nome, public as publico, file_size_limit as limite_bytes
  from storage.buckets where id = 'avatars'
union all
select 'ok' as tipo, 'script executado com sucesso' as nome, true, 0;
