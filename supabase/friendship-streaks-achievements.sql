-- Brazilly: friendship streaks and achievement awards.
-- Run after social-engagement-suite.sql.
create table if not exists public.friendship_streaks(
 user_one uuid not null references public.profiles(user_id) on delete cascade,
 user_two uuid not null references public.profiles(user_id) on delete cascade,
 current_streak integer not null default 1 check(current_streak>=1),
 longest_streak integer not null default 1 check(longest_streak>=current_streak),
 last_interaction_date date not null default current_date,
 updated_at timestamptz not null default now(),
 primary key(user_one,user_two),check(user_one<user_two)
);
alter table public.friendship_streaks enable row level security;
drop policy if exists friendship_streaks_participants_read on public.friendship_streaks;
create policy friendship_streaks_participants_read on public.friendship_streaks for select to authenticated using((select auth.uid()) in(user_one,user_two));
grant select on public.friendship_streaks to authenticated;

create or replace function public.track_friendship_streak_message()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_other uuid;v_one uuid;v_two uuid;v_today date:=current_date;v_streak integer;
begin
 select case when c.user_one=new.sender_id then c.user_two else c.user_one end into v_other
 from public.conversations c where c.id=new.conversation_id and new.sender_id in(c.user_one,c.user_two);
 if v_other is null or not exists(select 1 from public.friend_requests f where f.status='accepted' and f.user_one=least(new.sender_id,v_other) and f.user_two=greatest(new.sender_id,v_other)) then return new; end if;
 v_one:=least(new.sender_id,v_other);v_two:=greatest(new.sender_id,v_other);
 insert into public.friendship_streaks(user_one,user_two,current_streak,longest_streak,last_interaction_date) values(v_one,v_two,1,1,v_today)
 on conflict(user_one,user_two) do update set
 current_streak=case when friendship_streaks.last_interaction_date=v_today then friendship_streaks.current_streak when friendship_streaks.last_interaction_date=v_today-1 then friendship_streaks.current_streak+1 else 1 end,
 longest_streak=greatest(friendship_streaks.longest_streak,case when friendship_streaks.last_interaction_date=v_today then friendship_streaks.current_streak when friendship_streaks.last_interaction_date=v_today-1 then friendship_streaks.current_streak+1 else 1 end),
 last_interaction_date=v_today,updated_at=now()
 returning current_streak into v_streak;
 if v_streak>=3 then insert into public.user_achievements(user_id,achievement_key) values(v_one,'friendship_streak_3'),(v_two,'friendship_streak_3') on conflict do nothing; end if;
 return new;
end; $$;
revoke all on function public.track_friendship_streak_message() from public,anon,authenticated;
drop trigger if exists messages_track_friendship_streak on public.messages;
create trigger messages_track_friendship_streak after insert on public.messages for each row execute function public.track_friendship_streak_message();

create or replace function public.award_social_achievement()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_user uuid;
begin
 if tg_table_name='profile_wall_posts' then v_user:=new.author_id;
 elsif tg_table_name='daily_question_answers' then v_user:=new.user_id;
 elsif tg_table_name='community_poll_votes' then v_user:=new.user_id;
 elsif tg_table_name='social_events' then v_user:=new.created_by;
 else return new; end if;
 if tg_table_name='profile_wall_posts' then insert into public.user_achievements(user_id,achievement_key) values(v_user,'first_guestbook') on conflict do nothing;
 elsif tg_table_name='daily_question_answers' then insert into public.user_achievements(user_id,achievement_key) values(v_user,'first_daily_answer') on conflict do nothing;
 elsif tg_table_name='community_poll_votes' then insert into public.user_achievements(user_id,achievement_key) values(v_user,'first_poll_vote') on conflict do nothing;
 elsif tg_table_name='social_events' then insert into public.user_achievements(user_id,achievement_key) values(v_user,'first_event_host') on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.award_social_achievement() from public,anon,authenticated;
drop trigger if exists wall_post_award_achievement on public.profile_wall_posts;
create trigger wall_post_award_achievement after insert on public.profile_wall_posts for each row execute function public.award_social_achievement();
drop trigger if exists daily_answer_award_achievement on public.daily_question_answers;
create trigger daily_answer_award_achievement after insert on public.daily_question_answers for each row execute function public.award_social_achievement();
drop trigger if exists poll_vote_award_achievement on public.community_poll_votes;
create trigger poll_vote_award_achievement after insert on public.community_poll_votes for each row execute function public.award_social_achievement();
drop trigger if exists event_award_achievement on public.social_events;
create trigger event_award_achievement after insert on public.social_events for each row execute function public.award_social_achievement();

create or replace function public.get_my_friendship_streaks()
returns table(friend_id uuid,friend_name text,current_streak integer,longest_streak integer,last_interaction_date date)
language plpgsql stable security definer set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return query select case when s.user_one=auth.uid() then s.user_two else s.user_one end,p.display_name,s.current_streak,s.longest_streak,s.last_interaction_date
 from public.friendship_streaks s join public.profiles p on p.user_id=case when s.user_one=auth.uid() then s.user_two else s.user_one end
 where auth.uid() in(s.user_one,s.user_two) order by s.current_streak desc,s.updated_at desc limit 30;
end; $$;
revoke all on function public.get_my_friendship_streaks() from public,anon;
grant execute on function public.get_my_friendship_streaks() to authenticated;
