-- Brazilly performance optimizations
-- Safe additive RPCs and a query-plan improvement for community message reads.

create or replace function public.list_my_conversations_fast()
returns table (conversation_id uuid, other_user_id uuid, display_name text, updated_at timestamptz, last_message_body text, last_message_created_at timestamptz, nickname text)
language sql stable security definer set search_path = public
as $function$
  select c.id,
    case when c.user_one = auth.uid() then c.user_two else c.user_one end,
    p.display_name, c.updated_at, latest.body, latest.created_at, settings.nickname
  from public.conversations c
  join public.profiles p on p.user_id = case when c.user_one = auth.uid() then c.user_two else c.user_one end
  left join lateral (
    select m.body, m.created_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) latest on true
  left join public.conversation_user_settings settings
    on settings.conversation_id = c.id and settings.user_id = auth.uid()
  where auth.uid() is not null and auth.uid() in (c.user_one, c.user_two)
    and not public.is_blocked_between(c.user_one, c.user_two)
  order by c.updated_at desc;
$function$;
revoke all on function public.list_my_conversations_fast() from public, anon;
grant execute on function public.list_my_conversations_fast() to authenticated;

create or replace function public.get_communities_fast()
returns table (id uuid, name text, description text, category text, created_at timestamptz, created_by uuid, member_count bigint, is_member boolean)
language sql stable security definer set search_path = public
as $function$
  select c.id, c.name, c.description, c.category, c.created_at, c.created_by,
    coalesce(m.member_count, 0)::bigint,
    exists (select 1 from public.community_members mine where mine.community_id = c.id and mine.user_id = auth.uid())
  from public.communities c
  left join lateral (
    select count(*)::bigint as member_count from public.community_members cm where cm.community_id = c.id
  ) m on true
  where auth.uid() is not null
  order by c.created_at desc limit 100;
$function$;
revoke all on function public.get_communities_fast() from public, anon;
grant execute on function public.get_communities_fast() to authenticated;

create or replace function public.get_story_feed_fast()
returns table (story_id uuid, user_id uuid, display_name text, caption text, media_path text, audience text, created_at timestamptz, expires_at timestamptz, view_count bigint, viewed_by_me boolean, avatar_storage_path text)
language sql stable security definer set search_path = public
as $function$
  select s.id, s.user_id, p.display_name, s.caption, s.media_path, s.audience, s.created_at, s.expires_at,
    (select count(*) from public.story_views v where v.story_id = s.id),
    exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()),
    avatar.storage_path
  from public.stories s
  join public.profiles p on p.user_id = s.user_id
  left join lateral (
    select pp.storage_path from public.profile_photos pp
    where pp.user_id = s.user_id and pp.is_primary = true order by pp.sort_order limit 1
  ) avatar on true
  where auth.uid() is not null and s.expires_at > now()
    and public.can_view_story(s.user_id, s.audience)
  order by s.created_at desc;
$function$;
revoke all on function public.get_story_feed_fast() from public, anon;
grant execute on function public.get_story_feed_fast() to authenticated;

create or replace function public.get_community_messages(p_community_id uuid)
returns table (message_id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz, read_count bigint, member_count bigint)
language plpgsql security definer set search_path = public
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.community_members m where m.community_id = p_community_id and m.user_id = auth.uid()
  ) then raise exception 'Você não participa desta comunidade.'; end if;
  return query
  with recent as materialized (
    select cm.id, cm.sender_id, cm.body, cm.created_at
    from public.community_messages cm where cm.community_id = p_community_id
    order by cm.created_at desc limit 300
  ),
  read_counts as (
    select r.message_id, count(*)::bigint as read_count
    from public.community_message_reads r
    where r.message_id in (select recent.id from recent)
    group by r.message_id
  ),
  members as (
    select count(*)::bigint as member_count from public.community_members m where m.community_id = p_community_id
  )
  select recent.id, recent.sender_id, coalesce(p.display_name, 'Pessoa'), recent.body, recent.created_at,
    coalesce(rc.read_count, 0), members.member_count
  from recent
  left join public.profiles p on p.user_id = recent.sender_id
  left join read_counts rc on rc.message_id = recent.id
  cross join members
  order by recent.created_at asc;
end;
$function$;
