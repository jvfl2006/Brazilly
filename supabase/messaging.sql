-- BRAZILLY: migração de mensagens diretas
-- Execute UMA vez no Supabase > SQL Editor. Não apaga dados existentes.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(user_id) on delete cascade,
  user_two uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_distinct_users check (user_one <> user_two),
  constraint conversations_canonical_pair check (user_one < user_two),
  constraint conversations_unique_pair unique (user_one,user_two)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists conversations_user_one_updated_idx on public.conversations(user_one,updated_at desc);
create index if not exists conversations_user_two_updated_idx on public.conversations(user_two,updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);

create or replace function public.get_or_create_conversation(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_one uuid;
  v_two uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Entre na sua conta para iniciar uma conversa.'; end if;
  if p_other_user is null or p_other_user = v_me then raise exception 'Perfil de destino inválido.'; end if;
  if not exists(select 1 from public.profiles where user_id = p_other_user) then
    raise exception 'Esse perfil não está disponível.';
  end if;
  if exists(select 1 from public.user_blocks b where
    (b.blocker_id=v_me and b.blocked_id=p_other_user) or
    (b.blocker_id=p_other_user and b.blocked_id=v_me)) then
    raise exception 'Não é possível conversar com esse perfil.';
  end if;
  v_one := least(v_me,p_other_user);
  v_two := greatest(v_me,p_other_user);
  insert into public.conversations(user_one,user_two)
    values(v_one,v_two)
    on conflict(user_one,user_two) do nothing;
  select id into v_id from public.conversations where user_one=v_one and user_two=v_two;
  return v_id;
end;
$$;

revoke all on function public.get_or_create_conversation(uuid) from public;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

create or replace function public.is_blocked_between(p_user_a uuid,p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.user_blocks
    where (blocker_id=p_user_a and blocked_id=p_user_b)
       or (blocker_id=p_user_b and blocked_id=p_user_a));
$$;
revoke all on function public.is_blocked_between(uuid,uuid) from public;
grant execute on function public.is_blocked_between(uuid,uuid) to authenticated;

revoke all on function public.is_blocked_between(uuid,uuid) from public;
grant execute on function public.is_blocked_between(uuid,uuid) to authenticated;

create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  display_name text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $
  select c.id,
    case when c.user_one=auth.uid() then c.user_two else c.user_one end,
    p.display_name,
    c.updated_at
  from public.conversations c
  join public.profiles p on p.user_id =
    case when c.user_one=auth.uid() then c.user_two else c.user_one end
  where auth.uid() in (c.user_one,c.user_two)
    and not public.is_blocked_between(c.user_one,c.user_two)
  order by c.updated_at desc;
$;
revoke all on function public.list_my_conversations() from public;
grant execute on function public.list_my_conversations() to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_read_participant on public.conversations;
create policy conversations_read_participant on public.conversations
for select to authenticated using (
  (auth.uid()=user_one or auth.uid()=user_two)
  and not public.is_blocked_between(user_one,user_two)
);

drop policy if exists messages_read_participant on public.messages;
create policy messages_read_participant on public.messages
for select to authenticated using (
  exists(select 1 from public.conversations c where c.id=conversation_id
    and (auth.uid()=c.user_one or auth.uid()=c.user_two))
  and exists(select 1 from public.conversations c where c.id=conversation_id
    and not public.is_blocked_between(c.user_one,c.user_two))
);

drop policy if exists messages_send_as_self on public.messages;
create policy messages_send_as_self on public.messages
for insert to authenticated with check (
  sender_id=auth.uid()
  and exists(select 1 from public.conversations c where c.id=conversation_id
    and (auth.uid()=c.user_one or auth.uid()=c.user_two))
  and exists(select 1 from public.conversations c where c.id=conversation_id
    and not public.is_blocked_between(c.user_one,c.user_two))
);

drop policy if exists messages_mark_received_read on public.messages;
create policy messages_mark_received_read on public.messages
for update to authenticated using (
  sender_id <> auth.uid()
  and exists(select 1 from public.conversations c where c.id=conversation_id
    and (auth.uid()=c.user_one or auth.uid()=c.user_two)
    and not public.is_blocked_between(c.user_one,c.user_two))
) with check (
  sender_id <> auth.uid()
  and exists(select 1 from public.conversations c where c.id=conversation_id
    and (auth.uid()=c.user_one or auth.uid()=c.user_two)
    and not public.is_blocked_between(c.user_one,c.user_two))
);

grant select on public.conversations to authenticated;
grant select,insert on public.messages to authenticated;
grant update(read_at) on public.messages to authenticated;

create or replace function public.bump_conversation_updated_at()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end;
$$;
drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation after insert on public.messages
for each row execute function public.bump_conversation_updated_at();

-- Habilita mensagens no Supabase Realtime sem duplicar a publicação.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
