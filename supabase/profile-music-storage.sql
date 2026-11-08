-- Brazilly profile soundtrack uploads.
-- Common browser-playable audio formats, with a 30 MiB per-file limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
 'profile-music',
 'profile-music',
 true,
 31457280,
 array['audio/*']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_music_upload_own_folder on storage.objects;
create policy profile_music_upload_own_folder
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-music'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists profile_music_delete_own_folder on storage.objects;
create policy profile_music_delete_own_folder
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-music'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
