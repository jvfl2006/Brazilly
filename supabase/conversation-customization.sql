-- BRAZILLY: apelidos, wallpapers individuais e acesso ao perfil pelo chat
-- Execute no Supabase SQL Editor depois de messaging.sql.
-- Migração aditiva; não remove nem altera mensagens existentes.

create table if not exists public.conversation_user_settings (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) <= 40),
  wallpaper text not null default 'default' check (wallpaper in ('default','purple','midnight','forest')),
  updated_at timestamptz not null default now(),
  primary key (user_id,conversation_id)
);
alter table public.conversation_user_settings enable row level security;
drop policy if exists "conversation_settings_select_own" on public.conversation_user_settings;
create policy "conversation_settings_select_own" on public.conversation_user_settings
for select to authenticated using (
 user_id=auth.uid() and exists(select 1 from public.conversations c
 where c.id=conversation_id and auth.uid() in (c.user_one,c.user_two))
);
drop policy if exists "conversation_settings_insert_own" on public.conversation_user_settings;
create policy "conversation_settings_insert_own" on public.conversation_user_settings
for insert to authenticated with check (
 user_id=auth.uid() and exists(select 1 from public.conversations c
 where c.id=conversation_id and auth.uid() in (c.user_one,c.user_two))
);
drop policy if exists "conversation_settings_update_own" on public.conversation_user_settings;
create policy "conversation_settings_update_own" on public.conversation_user_settings
for update to authenticated using (
 user_id=auth.uid() and exists(select 1 from public.conversations c
 where c.id=conversation_id and auth.uid() in (c.user_one,c.user_two))
) with check (
 user_id=auth.uid() and exists(select 1 from public.conversations c
 where c.id=conversation_id and auth.uid() in (c.user_one,c.user_two))
);
grant select,insert,update on public.conversation_user_settings to authenticated;

create or replace function public.get_profile_for_conversation(p_conversation_id uuid)
returns table(
 user_id uuid,display_name text,age integer,gender text,bio text,city text,
 education text,profession text,religion text,relationship_status text,
 intentions text[],interests text[],photo_paths text[]
)
language plpgsql stable security definer set search_path=public,extensions
as $chat_profile$
declare v_other uuid;
begin
 select case when c.user_one=auth.uid() then c.user_two else c.user_one end
 into v_other from public.conversations c
 where c.id=p_conversation_id and auth.uid() in (c.user_one,c.user_two)
 and not public.is_blocked_between(c.user_one,c.user_two);
 if v_other is null then raise exception 'Conversa ou perfil indisponível.'; end if;
 return query
 select p.user_id,p.display_name,
  case when p.show_age then extract(year from age(current_date,p.birth_date))::integer else null end,
  p.gender,p.bio,case when p.show_city then p.city else null end,
  p.education,p.profession,p.religion,p.relationship_status,p.intentions,
  coalesce((select array_agg(i.interest_name order by i.interest_name) from public.user_interests i where i.user_id=p.user_id),'{}'::text[]),
  coalesce((select array_agg(ph.storage_path order by ph.sort_order) from public.profile_photos ph where ph.user_id=p.user_id),'{}'::text[])
 from public.profiles p where p.user_id=v_other;
end;
$chat_profile$;
revoke all on function public.get_profile_for_conversation(uuid) from public;
grant execute on function public.get_profile_for_conversation(uuid) to authenticated;
