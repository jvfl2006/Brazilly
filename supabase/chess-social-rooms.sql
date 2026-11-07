-- Brazilly Games: salas sociais de xadrez.
-- Todas as mutações passam pela Edge Function chess-api, que valida as jogadas
-- com chess.js no servidor. O navegador recebe somente SELECT e eventos Realtime.
create table if not exists public.chess_rooms (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 3 and 60),
 invite_code text not null unique,
 is_public boolean not null default true,
 status text not null default 'open' check (status in ('open','playing','closed')),
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists chess_rooms_directory_idx on public.chess_rooms(is_public,status,updated_at desc);
create table if not exists public.chess_room_members (
 room_id uuid not null references public.chess_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null default 'Jogador',
 seat text not null default 'spectator' check (seat in ('white','black','spectator')),
 role text not null default 'member' check (role in ('host','member')),
 joined_at timestamptz not null default now(),
 primary key(room_id,user_id)
);
create index if not exists chess_room_members_user_idx on public.chess_room_members(user_id,joined_at desc);
create unique index if not exists chess_room_one_white_idx on public.chess_room_members(room_id) where seat='white';
create unique index if not exists chess_room_one_black_idx on public.chess_room_members(room_id) where seat='black';
create table if not exists public.chess_games (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.chess_rooms(id) on delete cascade,
 fen text not null,
 pgn text not null default '',
 ply integer not null default 0 check (ply >= 0),
 status text not null default 'active' check (status in ('active','checkmate','draw','resigned')),
 winner text check (winner in ('white','black') or winner is null),
 last_move_san text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists chess_games_room_created_idx on public.chess_games(room_id,created_at desc);
create unique index if not exists chess_games_one_active_per_room_idx on public.chess_games(room_id) where status='active';
create table if not exists public.chess_room_messages (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.chess_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null default 'Jogador',
 body text not null check (char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists chess_room_messages_timeline_idx on public.chess_room_messages(room_id,created_at desc);
alter table public.chess_rooms enable row level security;
alter table public.chess_room_members enable row level security;
alter table public.chess_games enable row level security;
alter table public.chess_room_messages enable row level security;
grant select on public.chess_room_members,public.chess_games,public.chess_room_messages to authenticated;
create or replace function public.is_chess_room_member(p_room_id uuid)
returns boolean language sql security definer set search_path = ''
as $ select exists(select 1 from public.chess_room_members m where m.room_id=p_room_id and m.user_id=(select auth.uid())); $;
revoke all on function public.is_chess_room_member(uuid) from public,anon;
grant execute on function public.is_chess_room_member(uuid) to authenticated;
drop policy if exists chess_members_read_room on public.chess_room_members;
create policy chess_members_read_room on public.chess_room_members for select to authenticated
 using ((select public.is_chess_room_member(room_id)));
drop policy if exists chess_games_read_room_members on public.chess_games;
create policy chess_games_read_room_members on public.chess_games for select to authenticated
 using ((select public.is_chess_room_member(room_id)));
drop policy if exists chess_messages_read_room_members on public.chess_room_messages;
create policy chess_messages_read_room_members on public.chess_room_messages for select to authenticated
 using ((select public.is_chess_room_member(room_id)));
revoke insert,update,delete on public.chess_rooms,public.chess_room_members,public.chess_games,public.chess_room_messages from anon,authenticated;
do $chess_realtime$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chess_games') then
   alter publication supabase_realtime add table public.chess_games;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chess_room_messages') then
   alter publication supabase_realtime add table public.chess_room_messages;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chess_room_members') then
   alter publication supabase_realtime add table public.chess_room_members;
  end if;
 end if;
end;
$chess_realtime$;
