insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-scenes','profile-scenes',false,31457280,array['image/gif','image/webp','image/png','image/jpeg','image/avif','video/mp4','video/webm'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "profile_scenes_upload_own" on storage.objects;
create policy "profile_scenes_upload_own" on storage.objects for insert to authenticated
with check (bucket_id='profile-scenes' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "profile_scenes_read_visible_profiles" on storage.objects;
create policy "profile_scenes_read_visible_profiles" on storage.objects for select to authenticated
using (bucket_id='profile-scenes' and (owner_id=(select auth.uid())::text or public.can_view_profile(((storage.foldername(name))[1])::uuid)));

drop policy if exists "profile_scenes_delete_own" on storage.objects;
create policy "profile_scenes_delete_own" on storage.objects for delete to authenticated
using (bucket_id='profile-scenes' and (storage.foldername(name))[1]=(select auth.uid())::text);
