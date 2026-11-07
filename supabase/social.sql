-- BRAZILLY: recursos sociais e campos adicionais de perfil
-- Execute no Supabase SQL Editor depois de schema.sql e messaging.sql.
-- Migração aditiva: não apaga contas, perfis ou conversas.

alter table public.profiles
  add column if not exists religion text,
  add column if not exists profession text,
  add column if not exists relationship_status text,
  add column if not exists is_private boolean not null default false;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_distinct check (requester_id <> recipient_id),
  constraint friend_requests_pair unique (requester_id,recipient_id)
);

create table if not exists public.user_favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  favorite_user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,favorite_user_id),
  constraint favorites_distinct check (user_id <> favorite_user_id)
);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests(recipient_id,status,created_at desc);
create index if not exists friend_requests_requester_idx
  on public.friend_requests(requester_id,status);
alter table public.friend_requests enable row level security;
alter table public.user_favorites enable row level security;

drop policy if exists friend_requests_read_participant on public.friend_requests;
create policy friend_requests_read_participant on public.friend_requests
for select to authenticated using (auth.uid() in (requester_id,recipient_id));

drop policy if exists friend_requests_send_self on public.friend_requests;
create policy friend_requests_send_self on public.friend_requests
for insert to authenticated with check (
  requester_id=auth.uid() and status='pending'
  and not public.is_blocked_between(auth.uid(),recipient_id)
);

drop policy if exists friend_requests_recipient_update on public.friend_requests;
create policy friend_requests_recipient_update on public.friend_requests
for update to authenticated
using (recipient_id=auth.uid() and status='pending')
with check (recipient_id=auth.uid() and status in ('accepted','rejected'));

drop policy if exists favorites_read_own on public.user_favorites;
create policy favorites_read_own on public.user_favorites
for select to authenticated using (user_id=auth.uid());
drop policy if exists favorites_insert_own on public.user_favorites;
create policy favorites_insert_own on public.user_favorites
for insert to authenticated with check (
  user_id=auth.uid() and favorite_user_id<>auth.uid()
);
drop policy if exists favorites_delete_own on public.user_favorites;
create policy favorites_delete_own on public.user_favorites
for delete to authenticated using (user_id=auth.uid());

grant select,insert on public.friend_requests to authenticated;
grant update(status) on public.friend_requests to authenticated;
grant select,insert,delete on public.user_favorites to authenticated;

-- Função única para bloquear: remove amizade/solicitações e bloqueia mensagens.
create or replace function public.block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $block$
begin
  if auth.uid() is null or p_user_id is null or p_user_id=auth.uid() then
    raise exception 'Usuário inválido.';
  end if;
  insert into public.user_blocks(blocker_id,blocked_id)
  values(auth.uid(),p_user_id) on conflict do nothing;
  delete from public.friend_requests
   where (requester_id=auth.uid() and recipient_id=p_user_id)
      or (requester_id=p_user_id and recipient_id=auth.uid());
  delete from public.user_favorites
   where user_id=auth.uid() and favorite_user_id=p_user_id;
end;
$block$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

-- Perfil privado: só o próprio usuário e amizades aceitas podem ver os dados completos.
create or replace function public.can_view_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $visibility$
  select auth.uid()=p_user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id=p_user_id and not p.is_private
    )
    or exists (
      select 1 from public.friend_requests f
      where f.status='accepted'
        and ((f.requester_id=auth.uid() and f.recipient_id=p_user_id)
          or (f.requester_id=p_user_id and f.recipient_id=auth.uid()))
    );
$visibility$;
revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- RPC retorna apenas campos apropriados e respeita perfil privado/bloqueios.
create or replace function public.get_profile_details(p_user_id uuid)
returns table (
  user_id uuid, display_name text, age integer, gender text, bio text,
  city text, education text, intentions text[], interests text[],
  photo_paths text[], religion text, profession text, relationship_status text,
  is_private boolean
)
language plpgsql stable security definer set search_path=public as $details$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Entre na sua conta para visualizar perfis.'; end if;
  if exists(select 1 from public.user_blocks b where
    (b.blocker_id=v_me and b.blocked_id=p_user_id) or
    (b.blocker_id=p_user_id and b.blocked_id=v_me)) then
    raise exception 'Este perfil não está disponível.';
  end if;
  return query
  select p.user_id,p.display_name,
    case when public.can_view_profile(p.user_id) and p.show_age then extract(year from age(current_date,p.birth_date))::integer else null end,
    case when public.can_view_profile(p.user_id) then p.gender else null end,
    case when public.can_view_profile(p.user_id) then p.bio else 'Perfil privado · envie uma solicitação de amizade.' end,
    case when public.can_view_profile(p.user_id) and p.show_city then p.city else null end,
    case when public.can_view_profile(p.user_id) then p.education else null end,
    case when public.can_view_profile(p.user_id) then p.intentions else '{}'::text[] end,
    case when public.can_view_profile(p.user_id) then
      coalesce((select array_agg(i.interest_name order by i.interest_name)
        from public.user_interests i where i.user_id=p.user_id),'{}'::text[])
      else '{}'::text[] end,
    case when public.can_view_profile(p.user_id) then
      coalesce((select array_agg(ph.storage_path order by ph.sort_order)
        from public.profile_photos ph where ph.user_id=p.user_id),'{}'::text[])
      else '{}'::text[] end,
    case when public.can_view_profile(p.user_id) then p.religion else null end,
    case when public.can_view_profile(p.user_id) then p.profession else null end,
    case when public.can_view_profile(p.user_id) then p.relationship_status else null end,
    p.is_private
  from public.profiles p where p.user_id=p_user_id;
end;
$details$;
revoke all on function public.get_profile_details(uuid) from public;
grant execute on function public.get_profile_details(uuid) to authenticated;

-- Lista pedidos recebidos para a futura tela de solicitações.
create or replace function public.list_friend_requests()
returns table(id uuid, requester_id uuid, display_name text, created_at timestamptz)
language sql stable security definer set search_path=public as $requests$
  select f.id,f.requester_id,p.display_name,f.created_at
  from public.friend_requests f
  join public.profiles p on p.user_id=f.requester_id
  where f.recipient_id=auth.uid() and f.status='pending'
  order by f.created_at desc;
$requests$;
revoke all on function public.list_friend_requests() from public;
grant execute on function public.list_friend_requests() to authenticated;

-- Redefine a descoberta para que perfis privados não apareçam a desconhecidos.
create or replace function public.discover_profiles(
  p_min_age integer default 18,
  p_max_age integer default 99,
  p_gender text default null,
  p_intention text default null,
  p_interest text default null,
  p_city text default null,
  p_education text default null,
  p_exercise text default null,
  p_photos_only boolean default false,
  p_strict boolean default false,
  p_limit integer default 40
)
returns table (
  user_id uuid, display_name text, age integer, gender text, bio text,
  city text, education text, intentions text[], interests text[],
  photo_paths text[], match_score integer
)
language plpgsql security definer set search_path=public,extensions as $discover$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Autenticação necessária.'; end if;
  if p_min_age < 18 or p_max_age < p_min_age or p_max_age > 120 then
    raise exception 'Faixa etária inválida.';
  end if;
  return query
  with candidates as (
    select pr.user_id,pr.display_name,
      extract(year from age(current_date,pr.birth_date))::integer as calculated_age,
      case when pr.show_age then extract(year from age(current_date,pr.birth_date))::integer else null end as public_age,
      case when not pr.is_private or public.can_view_profile(pr.user_id) then pr.gender else null end as public_gender,
      case when not pr.is_private or public.can_view_profile(pr.user_id) then pr.bio else 'Perfil privado · envie uma solicitação de amizade.' end as public_bio,
      case when (not pr.is_private or public.can_view_profile(pr.user_id)) and pr.show_city then pr.city else null end as public_city,
      case when not pr.is_private or public.can_view_profile(pr.user_id) then pr.education else null end as public_education,
      case when not pr.is_private or public.can_view_profile(pr.user_id) then pr.intentions else '{}'::text[] end as public_intentions,
      case when not pr.is_private or public.can_view_profile(pr.user_id) then
        coalesce((select array_agg(ui.interest_name order by ui.interest_name) from public.user_interests ui where ui.user_id=pr.user_id),'{}'::text[])
        else '{}'::text[] end as interest_list,
      case when not pr.is_private or public.can_view_profile(pr.user_id) then
        coalesce((select array_agg(pp.storage_path order by pp.sort_order) from public.profile_photos pp where pp.user_id=pr.user_id),'{}'::text[])
        else '{}'::text[] end as photo_list,
      ((case when p_gender is not null and pr.gender=p_gender then 1 else 0 end)+
       (case when p_intention is not null and p_intention=any(pr.intentions) then 1 else 0 end)+
       (case when p_interest is not null and exists(select 1 from public.user_interests ui where ui.user_id=pr.user_id and ui.interest_name ilike '%'||p_interest||'%') then 1 else 0 end)+
       (case when p_city is not null and pr.show_city and pr.city ilike '%'||p_city||'%' then 1 else 0 end)+
       (case when p_education is not null and pr.education=p_education then 1 else 0 end)+
       (case when p_exercise is not null and pr.exercise_frequency=p_exercise then 1 else 0 end))::integer as score
    from public.profiles pr
    where pr.user_id<>v_uid
      and extract(year from age(current_date,pr.birth_date)) between p_min_age and p_max_age
      and (not p_photos_only or exists(select 1 from public.profile_photos pp where pp.user_id=pr.user_id and (not pr.is_private or public.can_view_profile(pr.user_id))))
      and not exists(select 1 from public.user_blocks b where
        (b.blocker_id=v_uid and b.blocked_id=pr.user_id) or
        (b.blocker_id=pr.user_id and b.blocked_id=v_uid))
  )
  select c.user_id,c.display_name,c.public_age,c.public_gender,c.public_bio,c.public_city,
    c.public_education,c.public_intentions,c.interest_list,c.photo_list,c.score
  from candidates c
  where not p_strict or c.score=
    ((p_gender is not null)::integer+(p_intention is not null)::integer+
     (p_interest is not null)::integer+(p_city is not null)::integer+
     (p_education is not null)::integer+(p_exercise is not null)::integer)
  order by c.score desc,c.display_name limit greatest(1,least(p_limit,100));
end;
$discover$;
revoke all on function public.discover_profiles(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) from public;
grant execute on function public.discover_profiles(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) to authenticated;


-- Fotos de perfil passam a ser privadas no Storage. O acesso é feito por URLs
-- assinadas, emitidas somente para o próprio usuário, perfis públicos ou amizades aceitas.
update storage.buckets set public = false where id = 'profile-photos';
drop policy if exists "profile_photos_public_read" on storage.objects;
drop policy if exists "profile_photos_read_visible_profiles" on storage.objects;
create policy "profile_photos_read_visible_profiles" on storage.objects
for select to authenticated using (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.profiles p
    where p.user_id::text = (storage.foldername(name))[1]
      and public.can_view_profile(p.user_id)
  )
);

-- Evita solicitações duplicadas em sentidos opostos para o mesmo par de usuários.
create unique index if not exists friend_requests_one_per_pair_idx
  on public.friend_requests (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  );
