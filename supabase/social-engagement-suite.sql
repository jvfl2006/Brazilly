-- Brazilly social engagement suite
-- Apply after schema.sql, social-features-bundle.sql and random-chat-communities.sql.
-- The same migration was applied to the connected Supabase project.
create table if not exists public.profile_visits(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(user_id) on delete cascade,visitor_id uuid not null references public.profiles(user_id) on delete cascade,visited_at timestamptz not null default now(),visible_to_owner boolean not null default true,check(profile_id<>visitor_id));
create index if not exists profile_visits_owner_time_idx on public.profile_visits(profile_id,visited_at desc);
alter table public.profile_visits enable row level security;
drop policy if exists profile_visits_insert_self on public.profile_visits;
create policy profile_visits_insert_self on public.profile_visits for insert to authenticated with check(visitor_id=(select auth.uid()) and profile_id<>(select auth.uid()));
drop policy if exists profile_visits_read_owner on public.profile_visits;
create policy profile_visits_read_owner on public.profile_visits for select to authenticated using(profile_id=(select auth.uid()) and visible_to_owner);
grant select,insert on public.profile_visits to authenticated;

create table if not exists public.profile_visit_preferences(user_id uuid primary key references public.profiles(user_id) on delete cascade,hide_my_visits boolean not null default false,updated_at timestamptz not null default now());
alter table public.profile_visit_preferences enable row level security;
drop policy if exists profile_visit_preferences_own on public.profile_visit_preferences;
create policy profile_visit_preferences_own on public.profile_visit_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update on public.profile_visit_preferences to authenticated;

create table if not exists public.profile_wall_posts(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(user_id) on delete cascade,author_id uuid not null references public.profiles(user_id) on delete cascade,body text not null check(char_length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now());
create index if not exists profile_wall_posts_timeline_idx on public.profile_wall_posts(profile_id,created_at desc);
alter table public.profile_wall_posts enable row level security;
drop policy if exists profile_wall_posts_read on public.profile_wall_posts;
create policy profile_wall_posts_read on public.profile_wall_posts for select to authenticated using(not public.is_blocked_between((select auth.uid()),profile_id) and not public.is_blocked_between((select auth.uid()),author_id));
drop policy if exists profile_wall_posts_insert on public.profile_wall_posts;
create policy profile_wall_posts_insert on public.profile_wall_posts for insert to authenticated with check(author_id=(select auth.uid()) and profile_id<>(select auth.uid()) and not public.is_blocked_between((select auth.uid()),profile_id));
drop policy if exists profile_wall_posts_delete on public.profile_wall_posts;
create policy profile_wall_posts_delete on public.profile_wall_posts for delete to authenticated using(author_id=(select auth.uid()) or profile_id=(select auth.uid()));
grant select,insert,delete on public.profile_wall_posts to authenticated;

create table if not exists public.daily_questions(id uuid primary key default gen_random_uuid(),question_date date not null unique default current_date,question text not null check(char_length(btrim(question)) between 5 and 240),created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
create table if not exists public.daily_question_answers(id uuid primary key default gen_random_uuid(),question_id uuid not null references public.daily_questions(id) on delete cascade,user_id uuid not null references public.profiles(user_id) on delete cascade,answer text not null check(char_length(btrim(answer)) between 1 and 500),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(question_id,user_id));
alter table public.daily_questions enable row level security; alter table public.daily_question_answers enable row level security;
drop policy if exists daily_questions_read on public.daily_questions;
create policy daily_questions_read on public.daily_questions for select to authenticated using(true);
drop policy if exists daily_questions_moderator_insert on public.daily_questions;
create policy daily_questions_moderator_insert on public.daily_questions for insert to authenticated with check((select public.is_brazilly_moderator()));
drop policy if exists daily_questions_moderator_update on public.daily_questions;
create policy daily_questions_moderator_update on public.daily_questions for update to authenticated using((select public.is_brazilly_moderator())) with check((select public.is_brazilly_moderator()));
drop policy if exists daily_answers_read on public.daily_question_answers;
create policy daily_answers_read on public.daily_question_answers for select to authenticated using(true);
drop policy if exists daily_answers_insert_own on public.daily_question_answers;
create policy daily_answers_insert_own on public.daily_question_answers for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists daily_answers_update_own on public.daily_question_answers;
create policy daily_answers_update_own on public.daily_question_answers for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update on public.daily_questions to authenticated;
grant select,insert,update on public.daily_question_answers to authenticated;
insert into public.daily_questions(question_date,question) values(current_date,'Qual habilidade você gostaria de aprender se tivesse tempo e dinheiro ilimitados?') on conflict(question_date) do nothing;

create table if not exists public.community_polls(id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities(id) on delete cascade,created_by uuid not null references auth.users(id) on delete cascade,question text not null check(char_length(btrim(question)) between 5 and 240),closes_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.community_poll_options(id uuid primary key default gen_random_uuid(),poll_id uuid not null references public.community_polls(id) on delete cascade,label text not null check(char_length(btrim(label)) between 1 and 120),position smallint not null check(position between 0 and 7),unique(poll_id,position));
create table if not exists public.community_poll_votes(poll_id uuid not null references public.community_polls(id) on delete cascade,option_id uuid not null references public.community_poll_options(id) on delete cascade,user_id uuid not null references public.profiles(user_id) on delete cascade,created_at timestamptz not null default now(),primary key(poll_id,user_id));
alter table public.community_polls enable row level security;alter table public.community_poll_options enable row level security;alter table public.community_poll_votes enable row level security;
drop policy if exists community_polls_member_read on public.community_polls;
create policy community_polls_member_read on public.community_polls for select to authenticated using(exists(select 1 from public.community_members m where m.community_id=community_polls.community_id and m.user_id=(select auth.uid())));
drop policy if exists community_polls_member_insert on public.community_polls;
create policy community_polls_member_insert on public.community_polls for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.community_members m where m.community_id=community_polls.community_id and m.user_id=(select auth.uid())));
drop policy if exists community_poll_options_member_read on public.community_poll_options;
create policy community_poll_options_member_read on public.community_poll_options for select to authenticated using(exists(select 1 from public.community_polls p join public.community_members m on m.community_id=p.community_id where p.id=community_poll_options.poll_id and m.user_id=(select auth.uid())));
drop policy if exists community_poll_options_creator_insert on public.community_poll_options;
create policy community_poll_options_creator_insert on public.community_poll_options for insert to authenticated with check(exists(select 1 from public.community_polls p where p.id=community_poll_options.poll_id and p.created_by=(select auth.uid())));
drop policy if exists community_poll_votes_member_read on public.community_poll_votes;
create policy community_poll_votes_member_read on public.community_poll_votes for select to authenticated using(exists(select 1 from public.community_polls p join public.community_members m on m.community_id=p.community_id where p.id=community_poll_votes.poll_id and m.user_id=(select auth.uid())));
drop policy if exists community_poll_votes_member_insert on public.community_poll_votes;
create policy community_poll_votes_member_insert on public.community_poll_votes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.community_polls p join public.community_members m on m.community_id=p.community_id join public.community_poll_options o on o.poll_id=p.id where p.id=community_poll_votes.poll_id and o.id=community_poll_votes.option_id and m.user_id=(select auth.uid()) and (p.closes_at is null or p.closes_at>now())));
grant select,insert on public.community_polls to authenticated;grant select,insert on public.community_poll_options to authenticated;grant select,insert on public.community_poll_votes to authenticated;

create table if not exists public.social_feed_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(user_id) on delete cascade,item_type text not null check(item_type in('wall_post','event_created','event_rsvp','poll_created','daily_answer')),reference_id uuid,body text not null check(char_length(body) between 1 and 500),visibility text not null default 'public' check(visibility in('public','friends')),created_at timestamptz not null default now());
create index if not exists social_feed_items_created_idx on public.social_feed_items(created_at desc);
alter table public.social_feed_items enable row level security;
drop policy if exists social_feed_items_read on public.social_feed_items;
create policy social_feed_items_read on public.social_feed_items for select to authenticated using(not public.is_blocked_between((select auth.uid()),user_id) and (visibility='public' or user_id=(select auth.uid()) or exists(select 1 from public.friend_requests f where f.status='accepted' and f.user_one=least((select auth.uid()),social_feed_items.user_id) and f.user_two=greatest((select auth.uid()),social_feed_items.user_id))));
drop policy if exists social_feed_items_insert_own on public.social_feed_items;
create policy social_feed_items_insert_own on public.social_feed_items for insert to authenticated with check(user_id=(select auth.uid()));
grant select,insert on public.social_feed_items to authenticated;

create table if not exists public.social_events(id uuid primary key default gen_random_uuid(),created_by uuid not null references auth.users(id) on delete cascade,title text not null check(char_length(btrim(title)) between 3 and 100),description text not null default '' check(char_length(description)<=1500),location text not null default '' check(char_length(location)<=160),starts_at timestamptz not null,ends_at timestamptz,visibility text not null default 'public' check(visibility in('public','friends')),created_at timestamptz not null default now(),check(ends_at is null or ends_at>starts_at));
create table if not exists public.social_event_rsvps(event_id uuid not null references public.social_events(id) on delete cascade,user_id uuid not null references public.profiles(user_id) on delete cascade,response text not null check(response in('going','interested')),created_at timestamptz not null default now(),primary key(event_id,user_id));
alter table public.social_events enable row level security;alter table public.social_event_rsvps enable row level security;
drop policy if exists social_events_read on public.social_events;
create policy social_events_read on public.social_events for select to authenticated using(not public.is_blocked_between((select auth.uid()),created_by) and (visibility='public' or created_by=(select auth.uid()) or exists(select 1 from public.friend_requests f where f.status='accepted' and f.user_one=least((select auth.uid()),social_events.created_by) and f.user_two=greatest((select auth.uid()),social_events.created_by))));
drop policy if exists social_events_insert on public.social_events;
create policy social_events_insert on public.social_events for insert to authenticated with check(created_by=(select auth.uid()));
drop policy if exists social_events_update on public.social_events;
create policy social_events_update on public.social_events for update to authenticated using(created_by=(select auth.uid())) with check(created_by=(select auth.uid()));
drop policy if exists social_events_delete on public.social_events;
create policy social_events_delete on public.social_events for delete to authenticated using(created_by=(select auth.uid()));
drop policy if exists social_event_rsvps_read on public.social_event_rsvps;
create policy social_event_rsvps_read on public.social_event_rsvps for select to authenticated using(exists(select 1 from public.social_events e where e.id=social_event_rsvps.event_id));
drop policy if exists social_event_rsvps_insert on public.social_event_rsvps;
create policy social_event_rsvps_insert on public.social_event_rsvps for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.social_events e where e.id=social_event_rsvps.event_id));
drop policy if exists social_event_rsvps_update on public.social_event_rsvps;
create policy social_event_rsvps_update on public.social_event_rsvps for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.social_events to authenticated;grant select,insert,update on public.social_event_rsvps to authenticated;

create table if not exists public.user_achievements(user_id uuid not null references public.profiles(user_id) on delete cascade,achievement_key text not null check(char_length(achievement_key)<=60),earned_at timestamptz not null default now(),primary key(user_id,achievement_key));
alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_read on public.user_achievements;
create policy user_achievements_read on public.user_achievements for select to authenticated using(true);
grant select on public.user_achievements to authenticated;

create table if not exists public.private_diary_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(user_id) on delete cascade,title text not null default '' check(char_length(title)<=120),body text not null check(char_length(body) between 1 and 10000),mood text check(mood is null or char_length(mood)<=30),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists private_diary_entries_user_time_idx on public.private_diary_entries(user_id,updated_at desc);
alter table public.private_diary_entries enable row level security;
drop policy if exists private_diary_entries_own on public.private_diary_entries;
create policy private_diary_entries_own on public.private_diary_entries for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.private_diary_entries to authenticated;

create table if not exists public.voice_rooms(id uuid primary key default gen_random_uuid(),created_by uuid not null references auth.users(id) on delete cascade,title text not null check(char_length(btrim(title)) between 3 and 80),is_public boolean not null default true,max_participants smallint not null default 4 check(max_participants between 2 and 4),created_at timestamptz not null default now(),closed_at timestamptz);
create table if not exists public.voice_room_members(room_id uuid not null references public.voice_rooms(id) on delete cascade,user_id uuid not null references public.profiles(user_id) on delete cascade,joined_at timestamptz not null default now(),primary key(room_id,user_id));
create table if not exists public.voice_room_signals(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.voice_rooms(id) on delete cascade,from_user uuid not null references auth.users(id) on delete cascade,to_user uuid not null references auth.users(id) on delete cascade,signal jsonb not null check(pg_column_size(signal)<=12000),created_at timestamptz not null default now());
alter table public.voice_rooms enable row level security;alter table public.voice_room_members enable row level security;alter table public.voice_room_signals enable row level security;
drop policy if exists voice_rooms_read on public.voice_rooms;
create policy voice_rooms_read on public.voice_rooms for select to authenticated using(closed_at is null and (is_public or created_by=(select auth.uid())));
drop policy if exists voice_rooms_insert on public.voice_rooms;
create policy voice_rooms_insert on public.voice_rooms for insert to authenticated with check(created_by=(select auth.uid()));
drop policy if exists voice_rooms_update_owner on public.voice_rooms;
create policy voice_rooms_update_owner on public.voice_rooms for update to authenticated using(created_by=(select auth.uid())) with check(created_by=(select auth.uid()));
drop policy if exists voice_rooms_delete_owner on public.voice_rooms;
create policy voice_rooms_delete_owner on public.voice_rooms for delete to authenticated using(created_by=(select auth.uid()));
drop policy if exists voice_members_read on public.voice_room_members;
create policy voice_members_read on public.voice_room_members for select to authenticated using(exists(select 1 from public.voice_rooms r where r.id=voice_room_members.room_id and (r.is_public or r.created_by=(select auth.uid()) or voice_room_members.user_id=(select auth.uid()))));
drop policy if exists voice_signals_read_participants on public.voice_room_signals;
create policy voice_signals_read_participants on public.voice_room_signals for select to authenticated using(to_user=(select auth.uid()) or from_user=(select auth.uid()));
drop policy if exists voice_signals_insert_member on public.voice_room_signals;
create policy voice_signals_insert_member on public.voice_room_signals for insert to authenticated with check(from_user=(select auth.uid()) and exists(select 1 from public.voice_room_members m where m.room_id=voice_room_signals.room_id and m.user_id=(select auth.uid())) and exists(select 1 from public.voice_room_members m where m.room_id=voice_room_signals.room_id and m.user_id=voice_room_signals.to_user));
grant select,insert,update,delete on public.voice_rooms to authenticated;grant select,insert,delete on public.voice_room_members to authenticated;grant select,insert on public.voice_room_signals to authenticated;

create or replace function public.join_voice_room(p_room_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare v_room public.voice_rooms%rowtype; v_count integer;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 select * into v_room from public.voice_rooms where id=p_room_id and closed_at is null for update;
 if not found then raise exception 'Sala indisponível.'; end if;
 if not v_room.is_public and v_room.created_by<>auth.uid() then raise exception 'Sala privada.'; end if;
 select count(*) into v_count from public.voice_room_members where room_id=p_room_id and user_id<>auth.uid();
 if v_count>=v_room.max_participants then raise exception 'A sala está cheia.'; end if;
 insert into public.voice_room_members(room_id,user_id) values(p_room_id,auth.uid()) on conflict(room_id,user_id) do nothing;
 return true;
end; $$;
create or replace function public.leave_voice_room(p_room_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare v_remaining integer;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 delete from public.voice_room_members where room_id=p_room_id and user_id=auth.uid();
 select count(*) into v_remaining from public.voice_room_members where room_id=p_room_id;
 if v_remaining=0 then update public.voice_rooms set closed_at=now() where id=p_room_id and closed_at is null; end if;
 return true;
end; $$;
revoke all on function public.join_voice_room(uuid),public.leave_voice_room(uuid) from public,anon;
grant execute on function public.join_voice_room(uuid),public.leave_voice_room(uuid) to authenticated;
revoke insert,delete on public.voice_room_members from authenticated;
do $realtime$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voice_room_signals') then alter publication supabase_realtime add table public.voice_room_signals; end if; end; $realtime$;

create or replace function public.get_profile_wall(p_profile_id uuid) returns table(id uuid,author_id uuid,author_name text,body text,created_at timestamptz) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 if not public.can_view_profile(p_profile_id) then raise exception 'Perfil indisponível.'; end if;
 return query select w.id,w.author_id,p.display_name,w.body,w.created_at from public.profile_wall_posts w join public.profiles p on p.user_id=w.author_id where w.profile_id=p_profile_id and not public.is_blocked_between(auth.uid(),w.author_id) order by w.created_at desc limit 50;
end; $$;
revoke all on function public.get_profile_wall(uuid) from public,anon;grant execute on function public.get_profile_wall(uuid) to authenticated;
create or replace function public.get_my_profile_visits() returns table(visitor_id uuid,visitor_name text,visited_at timestamptz) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return query select v.visitor_id,p.display_name,v.visited_at from public.profile_visits v join public.profiles p on p.user_id=v.visitor_id where v.profile_id=auth.uid() and v.visible_to_owner and not public.is_blocked_between(auth.uid(),v.visitor_id) order by v.visited_at desc limit 50;
end; $$;
revoke all on function public.get_my_profile_visits() from public,anon;grant execute on function public.get_my_profile_visits() to authenticated;
create or replace function public.get_social_feed(p_limit integer default 40) returns table(id uuid,user_id uuid,display_name text,item_type text,reference_id uuid,body text,created_at timestamptz) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return query select f.id,f.user_id,p.display_name,f.item_type,f.reference_id,f.body,f.created_at from public.social_feed_items f join public.profiles p on p.user_id=f.user_id where not public.is_blocked_between(auth.uid(),f.user_id) and (f.visibility='public' or f.user_id=auth.uid() or exists(select 1 from public.friend_requests fr where fr.status='accepted' and fr.user_one=least(auth.uid(),f.user_id) and fr.user_two=greatest(auth.uid(),f.user_id))) order by f.created_at desc limit greatest(1,least(p_limit,100));
end; $$;
revoke all on function public.get_social_feed(integer) from public,anon;grant execute on function public.get_social_feed(integer) to authenticated;
create or replace function public.get_social_events(p_limit integer default 40) returns table(id uuid,created_by uuid,creator_name text,title text,description text,location text,starts_at timestamptz,ends_at timestamptz,visibility text,attending_count bigint,my_response text) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return query select e.id,e.created_by,p.display_name,e.title,e.description,e.location,e.starts_at,e.ends_at,e.visibility,(select count(*) from public.social_event_rsvps r where r.event_id=e.id and r.response='going'),(select r.response from public.social_event_rsvps r where r.event_id=e.id and r.user_id=auth.uid()) from public.social_events e join public.profiles p on p.user_id=e.created_by where not public.is_blocked_between(auth.uid(),e.created_by) and (e.visibility='public' or e.created_by=auth.uid() or exists(select 1 from public.friend_requests fr where fr.status='accepted' and fr.user_one=least(auth.uid(),e.created_by) and fr.user_two=greatest(auth.uid(),e.created_by))) order by e.starts_at asc limit greatest(1,least(p_limit,100));
end; $$;
revoke all on function public.get_social_events(integer) from public,anon;grant execute on function public.get_social_events(integer) to authenticated;
create or replace function public.get_social_recommendations(p_limit integer default 20) returns table(user_id uuid,display_name text,city text,shared_interests text[],shared_count integer) language plpgsql stable security definer set search_path=public as $$
declare v_me uuid:=auth.uid();
begin
 if v_me is null then raise exception 'Entre na sua conta.'; end if;
 return query select p.user_id,p.display_name,case when p.show_city then p.city else null end,coalesce(array_agg(distinct mine.interest_name) filter(where mine.interest_name is not null),'{}'::text[]),count(distinct mine.interest_name)::integer from public.profiles p left join public.user_interests theirs on theirs.user_id=p.user_id left join public.user_interests mine on mine.user_id=v_me and lower(mine.interest_name)=lower(theirs.interest_name) where p.user_id<>v_me and coalesce(p.private_profile,false)=false and not public.is_blocked_between(v_me,p.user_id) and not exists(select 1 from public.friend_requests f where f.status='accepted' and f.user_one=least(v_me,p.user_id) and f.user_two=greatest(v_me,p.user_id)) group by p.user_id,p.display_name,p.show_city,p.city order by count(distinct mine.interest_name) desc,p.created_at desc limit greatest(1,least(p_limit,50));
end; $$;
revoke all on function public.get_social_recommendations(integer) from public,anon;grant execute on function public.get_social_recommendations(integer) to authenticated;

-- Follow-up hardening applied after the initial rollout.
drop policy if exists voice_rooms_delete_owner on public.voice_rooms;
create policy voice_rooms_delete_owner on public.voice_rooms for delete to authenticated using(created_by=(select auth.uid()));
create or replace function public.get_social_recommendations(p_limit integer default 20)
returns table(user_id uuid,display_name text,city text,shared_interests text[],shared_count integer)
language plpgsql stable security definer set search_path=public
as $$
declare v_me uuid:=auth.uid();
begin
 if v_me is null then raise exception 'Entre na sua conta.'; end if;
 return query select p.user_id,p.display_name,case when p.show_city then p.city else null end,
 coalesce(array_agg(distinct mine.interest_name) filter(where mine.interest_name is not null),'{}'::text[]),
 count(distinct mine.interest_name)::integer
 from public.profiles p left join public.user_interests theirs on theirs.user_id=p.user_id
 left join public.user_interests mine on mine.user_id=v_me and lower(mine.interest_name)=lower(theirs.interest_name)
 where p.user_id<>v_me and coalesce(p.private_profile,false)=false and not public.is_blocked_between(v_me,p.user_id)
 and not exists(select 1 from public.friend_requests f where f.status='accepted' and f.user_one=least(v_me,p.user_id) and f.user_two=greatest(v_me,p.user_id))
 group by p.user_id,p.display_name,p.show_city,p.city,p.created_at
 order by count(distinct mine.interest_name) desc,p.created_at desc limit greatest(1,least(p_limit,50));
end; $$;
revoke all on function public.get_social_recommendations(integer) from public,anon;
grant execute on function public.get_social_recommendations(integer) to authenticated;
