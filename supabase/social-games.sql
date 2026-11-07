-- Brazilly Games: jogos sociais adicionais
create table if not exists public.social_game_rooms (
 id uuid primary key default gen_random_uuid(),
 game_type text not null check (game_type in ('ludo','cards','connect4','battleship','tictactoe','quiz','draw')),
 name text not null check (char_length(btrim(name)) between 3 and 60),
 invite_code text not null unique,
 is_public boolean not null default true,
 status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
 created_by uuid not null references auth.users(id) on delete cascade,
 state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists social_game_rooms_directory_idx on public.social_game_rooms(game_type,is_public,status,updated_at desc);
create table if not exists public.social_game_members (
 room_id uuid not null references public.social_game_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null default 'Jogador',
 seat integer not null default 0,
 role text not null default 'member' check (role in ('host','member')),
 private_data jsonb not null default '{}'::jsonb,
 joined_at timestamptz not null default now(),
 primary key(room_id,user_id)
);
create index if not exists social_game_members_user_idx on public.social_game_members(user_id,joined_at desc);
create table if not exists public.social_game_messages (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.social_game_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null,
 body text not null check (char_length(btrim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists social_game_messages_timeline_idx on public.social_game_messages(room_id,created_at desc);
alter table public.social_game_rooms enable row level security;
alter table public.social_game_members enable row level security;
alter table public.social_game_messages enable row level security;
create schema if not exists private;
create or replace function private.is_social_game_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.social_game_members m where m.room_id=p_room_id and m.user_id=(select auth.uid())); $$;
revoke all on function private.is_social_game_member(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_social_game_member(uuid) to authenticated;
drop policy if exists social_game_rooms_member_read on public.social_game_rooms;
create policy social_game_rooms_member_read on public.social_game_rooms for select to authenticated using (private.is_social_game_member(id));
drop policy if exists social_game_members_room_read on public.social_game_members;
create policy social_game_members_room_read on public.social_game_members for select to authenticated using (private.is_social_game_member(room_id));
drop policy if exists social_game_messages_room_read on public.social_game_messages;
create policy social_game_messages_room_read on public.social_game_messages for select to authenticated using (private.is_social_game_member(room_id));
revoke insert,update,delete on public.social_game_rooms,public.social_game_members,public.social_game_messages from anon,authenticated;
grant select on public.social_game_members,public.social_game_messages to authenticated;
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_game_rooms') then alter publication supabase_realtime add table public.social_game_rooms; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_game_members') then alter publication supabase_realtime add table public.social_game_members; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_game_messages') then alter publication supabase_realtime add table public.social_game_messages; end if;
 end if;
end $$;
