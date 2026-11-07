-- BRAZILLY: envio de imagens, GIFs, figurinhas e áudios nas mensagens
-- Execute no Supabase SQL Editor depois de messaging.sql.
-- Migração aditiva; mensagens de texto existentes continuam funcionando.

alter table public.messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text','image','audio','gif','sticker')),
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size bigint,
  add column if not exists media_blurred boolean not null default false;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-media','chat-media',false,15728640,
 array['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict(id) do update set public=false,file_size_limit=15728640,
 allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "chat_media_read_participants" on storage.objects;
create policy "chat_media_read_participants" on storage.objects
for select to authenticated using (
 bucket_id='chat-media'
 and exists(
  select 1 from public.conversations c
  where c.id=(storage.foldername(name))[1]::uuid
   and auth.uid() in (c.user_one,c.user_two)
   and not public.is_blocked_between(c.user_one,c.user_two)
 )
);

drop policy if exists "chat_media_upload_sender" on storage.objects;
create policy "chat_media_upload_sender" on storage.objects
for insert to authenticated with check (
 bucket_id='chat-media'
 and (storage.foldername(name))[2]=auth.uid()::text
 and exists(
  select 1 from public.conversations c
  where c.id=(storage.foldername(name))[1]::uuid
   and auth.uid() in (c.user_one,c.user_two)
   and not public.is_blocked_between(c.user_one,c.user_two)
 )
);

drop policy if exists "chat_media_delete_sender" on storage.objects;
create policy "chat_media_delete_sender" on storage.objects
for delete to authenticated using (
 bucket_id='chat-media'
 and (storage.foldername(name))[2]=auth.uid()::text
 and exists(
  select 1 from public.conversations c
  where c.id=(storage.foldername(name))[1]::uuid
   and auth.uid() in (c.user_one,c.user_two)
 )
);

grant select,insert on storage.objects to authenticated;
