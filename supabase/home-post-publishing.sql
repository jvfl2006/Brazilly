-- Brazilly home post publishing: media, likes, comments and visibility.
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 caption text not null default '' check(char_length(caption)<=2200),
 filter_name text not null default 'none' check(filter_name in ('none','warm','mono','vivid','cool')),
 created_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_created_at_idx on public.posts(user_id,created_at desc);
create table if not exists public.post_media (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 storage_path text not null unique,
 media_type text not null check(media_type in ('image','video')),
 mime_type text not null,
 position smallint not null default 0 check(position between 0 and 9),
 created_at timestamptz not null default now(),
 unique(post_id,position)
);
create index if not exists post_media_post_position_idx on public.post_media(post_id,position);
create table if not exists public.post_likes (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.post_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists post_comments_post_created_idx on public.post_comments(post_id,created_at asc);
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists posts_read_authenticated on public.posts;
create policy posts_read_authenticated on public.posts for select to authenticated using(public.can_view_profile(user_id) and not public.is_blocked_between((select auth.uid()),user_id));
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists post_media_read_visible on public.post_media;
create policy post_media_read_visible on public.post_media for select to authenticated using(exists(select 1 from public.posts p where p.id=post_media.post_id and public.can_view_profile(p.user_id) and not public.is_blocked_between((select auth.uid()),p.user_id)));
drop policy if exists post_media_insert_own on public.post_media;
create policy post_media_insert_own on public.post_media for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_media.post_id and p.user_id=(select auth.uid())));
drop policy if exists post_media_delete_own on public.post_media;
create policy post_media_delete_own on public.post_media for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists post_likes_read_visible on public.post_likes;
create policy post_likes_read_visible on public.post_likes for select to authenticated using(exists(select 1 from public.posts p where p.id=post_likes.post_id and public.can_view_profile(p.user_id) and not public.is_blocked_between((select auth.uid()),p.user_id)));
drop policy if exists post_likes_insert_self on public.post_likes;
create policy post_likes_insert_self on public.post_likes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_likes.post_id and public.can_view_profile(p.user_id) and not public.is_blocked_between((select auth.uid()),p.user_id)));
drop policy if exists post_likes_delete_self on public.post_likes;
create policy post_likes_delete_self on public.post_likes for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists post_comments_read_visible on public.post_comments;
create policy post_comments_read_visible on public.post_comments for select to authenticated using(exists(select 1 from public.posts p where p.id=post_comments.post_id and public.can_view_profile(p.user_id) and not public.is_blocked_between((select auth.uid()),p.user_id)));
drop policy if exists post_comments_insert_self on public.post_comments;
create policy post_comments_insert_self on public.post_comments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_comments.post_id and public.can_view_profile(p.user_id) and not public.is_blocked_between((select auth.uid()),p.user_id)));
drop policy if exists post_comments_delete_own on public.post_comments;
create policy post_comments_delete_own on public.post_comments for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,update,delete on public.posts to authenticated;
grant select,insert,delete on public.post_media to authenticated;
grant select,insert,delete on public.post_likes to authenticated;
grant select,insert,delete on public.post_comments to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-media','post-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists post_media_storage_upload_own on storage.objects;
create policy post_media_storage_upload_own on storage.objects for insert to authenticated with check(bucket_id='post-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists post_media_storage_delete_own on storage.objects;
create policy post_media_storage_delete_own on storage.objects for delete to authenticated using(bucket_id='post-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists post_media_storage_read_visible on storage.objects;
create policy post_media_storage_read_visible on storage.objects for select to authenticated using(bucket_id='post-media' and public.can_view_profile((storage.foldername(name))[1]::uuid) and not public.is_blocked_between((select auth.uid()),(storage.foldername(name))[1]::uuid));

create or replace function public.get_home_posts(p_limit integer default 40)
returns table(id uuid,user_id uuid,display_name text,caption text,filter_name text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return query select p.id,p.user_id,pr.display_name,p.caption,p.filter_name,p.created_at from public.posts p join public.profiles pr on pr.user_id=p.user_id where public.can_view_profile(p.user_id) and not public.is_blocked_between(auth.uid(),p.user_id) order by p.created_at desc limit greatest(1,least(p_limit,60));
end; $$;
revoke all on function public.get_home_posts(integer) from public,anon;
grant execute on function public.get_home_posts(integer) to authenticated;

create or replace function public.get_post_comments(p_post_id uuid)
returns table(id uuid,user_id uuid,display_name text,body text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare v_owner uuid;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 select p.user_id into v_owner from public.posts p where p.id=p_post_id;
 if v_owner is null or not public.can_view_profile(v_owner) or public.is_blocked_between(auth.uid(),v_owner) then raise exception 'Publicação indisponível.'; end if;
 return query select c.id,c.user_id,pr.display_name,c.body,c.created_at from public.post_comments c join public.profiles pr on pr.user_id=c.user_id where c.post_id=p_post_id and public.can_view_profile(c.user_id) and not public.is_blocked_between(auth.uid(),c.user_id) order by c.created_at asc limit 60;
end; $$;
revoke all on function public.get_post_comments(uuid) from public,anon;
grant execute on function public.get_post_comments(uuid) to authenticated;

alter table public.social_feed_items drop constraint if exists social_feed_items_item_type_check;
alter table public.social_feed_items add constraint social_feed_items_item_type_check check(item_type in('wall_post','event_created','event_rsvp','poll_created','daily_answer','post_created'));
