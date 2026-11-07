-- Brazilly: experiência social (stories e leitura em grupos)
create table if not exists public.stories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 caption text not null default '' check(char_length(caption)<=300),
 media_path text not null,
 audience text not null default 'public' check(audience in ('public','friends')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 constraint stories_expiry_window check(expires_at>created_at and expires_at<=created_at+interval '25 hours')
);
create index if not exists stories_feed_idx on public.stories(expires_at desc,created_at desc);
create table if not exists public.story_views (
 story_id uuid not null references public.stories(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewed_at timestamptz not null default now(),
 primary key(story_id,viewer_id)
);
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
grant select,insert,delete on public.stories to authenticated;
grant select,insert on public.story_views to authenticated;
drop policy if exists stories_read_visible on public.stories;
create policy stories_read_visible on public.stories for select to authenticated using (
 expires_at>now() and (user_id=auth.uid() or audience='public' or
  (audience='friends' and exists(select 1 from public.friend_requests f where f.status='accepted' and
   ((f.user_one=auth.uid() and f.user_two=stories.user_id) or (f.user_two=auth.uid() and f.user_one=stories.user_id)))))
 and not public.is_blocked_between(auth.uid(),user_id)
);
drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories for insert to authenticated with check(user_id=auth.uid() and expires_at>now() and expires_at<=now()+interval '25 hours');
drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories for delete to authenticated using(user_id=auth.uid());
drop policy if exists story_views_read_related on public.story_views;
create policy story_views_read_related on public.story_views for select to authenticated using(viewer_id=auth.uid() or exists(select 1 from public.stories s where s.id=story_id and s.user_id=auth.uid()));
drop policy if exists story_views_insert_self on public.story_views;
create policy story_views_insert_self on public.story_views for insert to authenticated with check(viewer_id=auth.uid() and exists(select 1 from public.stories s where s.id=story_id and s.user_id<>auth.uid() and s.expires_at>now()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('story-media','story-media',false,15728640,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists story_media_upload_own on storage.objects;
create policy story_media_upload_own on storage.objects for insert to authenticated with check(bucket_id='story-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists story_media_read_visible on storage.objects;
create policy story_media_read_visible on storage.objects for select to authenticated using(bucket_id='story-media' and exists(
 select 1 from public.stories s where s.media_path=name and s.expires_at>now() and
 (s.user_id=auth.uid() or s.audience='public' or (s.audience='friends' and exists(select 1 from public.friend_requests f where f.status='accepted' and
 ((f.user_one=auth.uid() and f.user_two=s.user_id) or (f.user_two=auth.uid() and f.user_one=s.user_id)))))
 and not public.is_blocked_between(auth.uid(),s.user_id)));
drop policy if exists story_media_delete_own on storage.objects;
create policy story_media_delete_own on storage.objects for delete to authenticated using(bucket_id='story-media' and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function public.get_story_feed()
returns table(story_id uuid,user_id uuid,display_name text,caption text,media_path text,audience text,created_at timestamptz,expires_at timestamptz,view_count bigint,viewed_by_me boolean)
language sql security definer set search_path=public as $story_feed$
 select s.id,s.user_id,p.display_name,s.caption,s.media_path,s.audience,s.created_at,s.expires_at,
  (select count(*) from public.story_views v where v.story_id=s.id),
  exists(select 1 from public.story_views v where v.story_id=s.id and v.viewer_id=auth.uid())
 from public.stories s join public.profiles p on p.user_id=s.user_id
 where auth.uid() is not null and s.expires_at>now() and
 (s.user_id=auth.uid() or s.audience='public' or (s.audience='friends' and exists(select 1 from public.friend_requests f where f.status='accepted' and
 ((f.user_one=auth.uid() and f.user_two=s.user_id) or (f.user_two=auth.uid() and f.user_one=s.user_id)))))
 and not public.is_blocked_between(auth.uid(),s.user_id) order by s.created_at desc;
$story_feed$;
revoke all on function public.get_story_feed() from public,anon;
grant execute on function public.get_story_feed() to authenticated;

create table if not exists public.community_message_reads (
 message_id uuid not null references public.community_messages(id) on delete cascade,
 community_id uuid not null references public.communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(message_id,user_id)
);
create index if not exists community_message_reads_community_idx on public.community_message_reads(community_id,user_id);
alter table public.community_message_reads enable row level security;
grant select,insert on public.community_message_reads to authenticated;
drop policy if exists community_message_reads_member_select on public.community_message_reads;
create policy community_message_reads_member_select on public.community_message_reads for select to authenticated using(exists(select 1 from public.community_members m where m.community_id=community_message_reads.community_id and m.user_id=auth.uid()));
drop policy if exists community_message_reads_self_insert on public.community_message_reads;
create policy community_message_reads_self_insert on public.community_message_reads for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.community_members m where m.community_id=community_message_reads.community_id and m.user_id=auth.uid()) and exists(select 1 from public.community_messages cm where cm.id=message_id and cm.community_id=community_message_reads.community_id and cm.sender_id<>auth.uid()));
create or replace function public.get_community_messages(p_community_id uuid)
returns table(message_id uuid,sender_id uuid,sender_name text,body text,created_at timestamptz,read_count bigint)
language plpgsql security definer set search_path=public as $community_feed$
begin
 if auth.uid() is null or not exists(select 1 from public.community_members m where m.community_id=p_community_id and m.user_id=auth.uid()) then raise exception 'Você não participa desta comunidade.'; end if;
 return query select cm.id,cm.sender_id,coalesce(p.display_name,'Pessoa'),cm.body,cm.created_at,
 (select count(*) from public.community_message_reads r where r.message_id=cm.id)
 from public.community_messages cm left join public.profiles p on p.user_id=cm.sender_id
 where cm.community_id=p_community_id order by cm.created_at asc limit 300;
end;
$community_feed$;
revoke all on function public.get_community_messages(uuid) from public,anon;
grant execute on function public.get_community_messages(uuid) to authenticated;
create or replace function public.mark_community_messages_read(p_community_id uuid)
returns integer language plpgsql security definer set search_path=public as $mark_community_read$
declare v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.community_members m where m.community_id=p_community_id and m.user_id=auth.uid()) then raise exception 'Você não participa desta comunidade.'; end if;
 insert into public.community_message_reads(message_id,community_id,user_id)
 select cm.id,cm.community_id,auth.uid() from public.community_messages cm
 where cm.community_id=p_community_id and cm.sender_id<>auth.uid()
 on conflict(message_id,user_id) do nothing;
 get diagnostics v_count=row_count; return v_count;
end;
$mark_community_read$;
revoke all on function public.mark_community_messages_read(uuid) from public,anon;
grant execute on function public.mark_community_messages_read(uuid) to authenticated;
do $realtime$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and
 not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_message_reads') then
 alter publication supabase_realtime add table public.community_message_reads;
 end if;
end;
$realtime$;
