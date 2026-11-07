-- BRAZILLY: chat aleatorio e comunidades publicas
-- Executar uma vez no Supabase SQL Editor depois de social-features-bundle.sql.

create table if not exists public.random_chat_queue (
 user_id uuid primary key references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now()
);
create table if not exists public.random_chat_sessions (
 id uuid primary key default gen_random_uuid(),
 user_one uuid not null references auth.users(id) on delete cascade,
 user_two uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check(status in ('active','ended')),
 created_at timestamptz not null default now(),
 ended_at timestamptz,
 constraint random_chat_distinct_users check(user_one<>user_two)
);
create index if not exists random_chat_sessions_users_idx
 on public.random_chat_sessions(user_one,user_two,status);
create table if not exists public.random_chat_messages (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.random_chat_sessions(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists random_chat_messages_session_idx
 on public.random_chat_messages(session_id,created_at);
alter table public.random_chat_queue enable row level security;
alter table public.random_chat_sessions enable row level security;
alter table public.random_chat_messages enable row level security;
revoke all on public.random_chat_queue,public.random_chat_sessions,public.random_chat_messages from anon,authenticated;
grant select,insert on public.random_chat_messages to authenticated;
drop policy if exists random_chat_messages_participants_read on public.random_chat_messages;
create policy random_chat_messages_participants_read on public.random_chat_messages
 for select to authenticated using(exists(
  select 1 from public.random_chat_sessions s
  where s.id=session_id and auth.uid() in(s.user_one,s.user_two)
 ));
drop policy if exists random_chat_messages_sender_insert on public.random_chat_messages;
create policy random_chat_messages_sender_insert on public.random_chat_messages
 for insert to authenticated with check(sender_id=auth.uid() and exists(
  select 1 from public.random_chat_sessions s
  where s.id=session_id and s.status='active' and auth.uid() in(s.user_one,s.user_two)
 ));

create or replace function public.find_random_chat()
returns jsonb language plpgsql security definer set search_path=public
as $find_random_chat$
declare
 v_me uuid:=auth.uid(); v_session uuid; v_partner uuid; v_name text;
begin
 if v_me is null then raise exception 'Entre na sua conta para conversar.'; end if;
 perform pg_advisory_xact_lock(hashtext('brazilly_random_chat_matchmaking'));
 select s.id,case when s.user_one=v_me then s.user_two else s.user_one end
 into v_session,v_partner
 from public.random_chat_sessions s
 where s.status='active' and v_me in(s.user_one,s.user_two)
 order by s.created_at desc limit 1;
 if v_session is not null then
  select display_name into v_name from public.profiles where user_id=v_partner;
  return jsonb_build_object('status','matched','session_id',v_session,'partner_id',v_partner,'partner_name',coalesce(v_name,'Pessoa'));
 end if;
 delete from public.random_chat_queue where joined_at<now()-interval '3 minutes';
 select q.user_id into v_partner
 from public.random_chat_queue q
 join public.profiles p on p.user_id=q.user_id
 where q.user_id<>v_me
  and coalesce(p.private_profile,false)=false
  and not public.is_blocked_between(v_me,q.user_id)
 order by q.joined_at
 limit 1
 for update of q skip locked;
 if v_partner is not null then
  insert into public.random_chat_sessions(user_one,user_two)
  values(v_me,v_partner) returning id into v_session;
  delete from public.random_chat_queue where user_id in(v_me,v_partner);
  select display_name into v_name from public.profiles where user_id=v_partner;
  return jsonb_build_object('status','matched','session_id',v_session,'partner_id',v_partner,'partner_name',coalesce(v_name,'Pessoa'));
 end if;
 insert into public.random_chat_queue(user_id) values(v_me)
 on conflict(user_id) do update set joined_at=now();
 return jsonb_build_object('status','waiting');
end;
$find_random_chat$;

create or replace function public.leave_random_chat(p_session_id uuid default null)
returns boolean language plpgsql security definer set search_path=public
as $leave_random_chat$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 delete from public.random_chat_queue where user_id=auth.uid();
 if p_session_id is not null then
  update public.random_chat_sessions set status='ended',ended_at=now()
  where id=p_session_id and auth.uid() in(user_one,user_two) and status='active';
 end if;
 return true;
end;
$leave_random_chat$;

revoke all on function public.find_random_chat() from public;
revoke all on function public.leave_random_chat(uuid) from public;
grant execute on function public.find_random_chat() to authenticated;
grant execute on function public.leave_random_chat(uuid) to authenticated;

create table if not exists public.communities (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 3 and 60),
 description text not null default '' check(char_length(description)<=500),
 category text not null default 'Geral' check(char_length(category)<=40),
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.community_members (
 community_id uuid not null references public.communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in('owner','member')),
 joined_at timestamptz not null default now(),
 primary key(community_id,user_id)
);
create table if not exists public.community_messages (
 id uuid primary key default gen_random_uuid(),
 community_id uuid not null references public.communities(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists communities_created_idx on public.communities(created_at desc);
create index if not exists community_messages_timeline_idx on public.community_messages(community_id,created_at);
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;
grant select,insert on public.communities to authenticated;
grant select,insert,delete on public.community_members to authenticated;
grant select,insert on public.community_messages to authenticated;
drop policy if exists communities_read_authenticated on public.communities;
create policy communities_read_authenticated on public.communities for select to authenticated using(true);
drop policy if exists communities_create_authenticated on public.communities;
create policy communities_create_authenticated on public.communities for insert to authenticated with check(created_by=auth.uid());
drop policy if exists community_members_read on public.community_members;
create policy community_members_read on public.community_members for select to authenticated using(true);
drop policy if exists community_members_join on public.community_members;
create policy community_members_join on public.community_members for insert to authenticated with check(user_id=auth.uid() and role='member' and exists(select 1 from public.communities c where c.id=community_id));
drop policy if exists community_members_leave on public.community_members;
create policy community_members_leave on public.community_members for delete to authenticated using(user_id=auth.uid() and role='member');
drop policy if exists community_messages_read_members on public.community_messages;
create policy community_messages_read_members on public.community_messages for select to authenticated using(exists(
 select 1 from public.community_members m where m.community_id=community_messages.community_id and m.user_id=auth.uid()
));
drop policy if exists community_messages_send_members on public.community_messages;
create policy community_messages_send_members on public.community_messages for insert to authenticated with check(
 sender_id=auth.uid() and exists(select 1 from public.community_members m where m.community_id=community_id and m.user_id=auth.uid())
);
create or replace function public.create_community(p_name text,p_description text default '',p_category text default 'Geral')
returns uuid language plpgsql security definer set search_path=public
as $create_community$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 3 and 60 then raise exception 'O nome precisa ter entre 3 e 60 caracteres.'; end if;
 insert into public.communities(name,description,category,created_by)
 values(trim(p_name),left(trim(coalesce(p_description,'')),500),left(trim(coalesce(p_category,'Geral')),40),auth.uid())
 returning id into v_id;
 insert into public.community_members(community_id,user_id,role) values(v_id,auth.uid(),'owner');
 return v_id;
end;
$create_community$;
revoke all on function public.create_community(text,text,text) from public;
grant execute on function public.create_community(text,text,text) to authenticated;

-- Publicação Realtime: adiciona apenas tabelas de mensagens, sem duplicar entradas.
do $realtime$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='random_chat_messages') then
   alter publication supabase_realtime add table public.random_chat_messages;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_messages') then
   alter publication supabase_realtime add table public.community_messages;
  end if;
 end if;
end;
$realtime$;
