-- ============================================================
-- GUITAR DUELS — Execute este SQL no Supabase SQL Editor
-- Resolve: bucket rejeitando vídeos + políticas de segurança
-- ============================================================

-- 1. Atualizar bucket para aceitar vídeos até 20MB
update storage.buckets
set
  file_size_limit   = 20971520,
  allowed_mime_types = array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'
  ]
where id = 'avatars';

-- Caso o bucket ainda não exista, criar agora
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  20971520,
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'
  ]
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 20971520,
  allowed_mime_types = array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'
  ];

-- 2. Recriar políticas de Storage (limpar antigas primeiro)
drop policy if exists "avatars_public_read"   on storage.objects;
drop policy if exists "avatars_anon_upload"   on storage.objects;
drop policy if exists "avatars_anon_update"   on storage.objects;
drop policy if exists "avatars_anon_delete"   on storage.objects;
drop policy if exists "avatars_anon_list"     on storage.objects;
drop policy if exists "avatars_anon_insert"   on storage.objects;
drop policy if exists "avatars_anon_select"   on storage.objects;

-- Leitura pública
create policy "avatars_public_read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Upload (inserção)
create policy "avatars_anon_upload"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );

-- Atualização / upsert
create policy "avatars_anon_update"
  on storage.objects for update
  using ( bucket_id = 'avatars' );

-- Deleção (necessário para remover foto antiga ao trocar)
create policy "avatars_anon_delete"
  on storage.objects for delete
  using ( bucket_id = 'avatars' );

-- 3. Verificar resultado
select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'avatars';
