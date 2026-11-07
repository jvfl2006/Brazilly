-- BRAZILLY: estrutura inicial do backend Supabase
-- Execute este arquivo UMA vez em Supabase > SQL Editor > New query.
-- Não contém chaves secretas.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  birth_date date not null,
  gender text,
  sexuality text,
  height_cm integer check (height_cm is null or height_cm between 100 and 250),
  education text,
  personality_mbti text,
  pets text,
  children text,
  bio text check (bio is null or char_length(bio) <= 400),
  drink_frequency text,
  tobacco_frequency text,
  exercise_frequency text,
  intentions text[] not null default '{}',
  city text,
  show_age boolean not null default true,
  show_city boolean not null default false,
  last_seen_visible boolean not null default true,
  online_visible boolean not null default true,
  read_receipts boolean not null default true,
  media_download text not null default 'never' check (media_download in ('never','wifi','always')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_adult_only check (birth_date <= (current_date - interval '18 years')::date)
);

create table if not exists public.user_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  category text not null,
  interest_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, interest_name)
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 0 and 5),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, sort_order)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  reported_user_id uuid references public.profiles(user_id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 80),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create index if not exists user_interests_user_idx on public.user_interests(user_id);
create index if not exists user_interests_name_idx on public.user_interests(interest_name);
create index if not exists profile_photos_user_order_idx on public.profile_photos(user_id, sort_order);
create index if not exists profiles_birth_date_idx on public.profiles(birth_date);
create index if not exists profiles_city_idx on public.profiles(city);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_interests enable row level security;
alter table public.profile_photos enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interests_select_own" on public.user_interests;
create policy "interests_select_own" on public.user_interests for select to authenticated using (auth.uid() = user_id);
drop policy if exists "interests_insert_own" on public.user_interests;
create policy "interests_insert_own" on public.user_interests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "interests_delete_own" on public.user_interests;
create policy "interests_delete_own" on public.user_interests for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "photos_select_own" on public.profile_photos;
create policy "photos_select_own" on public.profile_photos for select to authenticated using (auth.uid() = user_id);
drop policy if exists "photos_insert_own" on public.profile_photos;
create policy "photos_insert_own" on public.profile_photos for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "photos_delete_own" on public.profile_photos;
create policy "photos_delete_own" on public.profile_photos for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "blocks_select_own" on public.user_blocks;
create policy "blocks_select_own" on public.user_blocks for select to authenticated using (auth.uid() = blocker_id);
drop policy if exists "blocks_insert_own" on public.user_blocks;
create policy "blocks_insert_own" on public.user_blocks for insert to authenticated with check (auth.uid() = blocker_id);
drop policy if exists "blocks_delete_own" on public.user_blocks;
create policy "blocks_delete_own" on public.user_blocks for delete to authenticated using (auth.uid() = blocker_id);

drop policy if exists "reports_insert_own" on public.user_reports;
create policy "reports_insert_own" on public.user_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "reports_select_own" on public.user_reports;
create policy "reports_select_own" on public.user_reports for select to authenticated using (auth.uid() = reporter_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.user_interests to authenticated;
grant select, insert, delete on public.profile_photos to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert on public.user_reports to authenticated;

-- Fotos de perfil são públicas para visualização, mas cada usuário só pode
-- enviar, substituir ou excluir arquivos dentro da própria pasta UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read" on storage.objects for select using (bucket_id = 'profile-photos');
drop policy if exists "profile_photos_upload_own_folder" on storage.objects;
create policy "profile_photos_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "profile_photos_update_own_folder" on storage.objects;
create policy "profile_photos_update_own_folder" on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "profile_photos_delete_own_folder" on storage.objects;
create policy "profile_photos_delete_own_folder" on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- RPC de descoberta: retorna somente campos apropriados para exibição pública.
-- Data de nascimento, sexualidade e hábitos não são expostos pela consulta.
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
  user_id uuid,
  display_name text,
  age integer,
  gender text,
  bio text,
  city text,
  education text,
  intentions text[],
  interests text[],
  photo_paths text[],
  match_score integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Autenticação necessária.'; end if;
  if p_min_age < 18 or p_max_age < p_min_age or p_max_age > 120 then
    raise exception 'Faixa etária inválida.';
  end if;
  return query
  with candidates as (
    select pr.user_id, pr.display_name,
      extract(year from age(current_date, pr.birth_date))::integer as calculated_age,
      case when pr.show_age then extract(year from age(current_date, pr.birth_date))::integer else null end as public_age,
      pr.gender, pr.bio,
      case when pr.show_city then pr.city else null end as public_city,
      pr.education, pr.intentions,
      coalesce((select array_agg(ui.interest_name order by ui.interest_name) from public.user_interests ui where ui.user_id=pr.user_id), '{}'::text[]) as interest_list,
      coalesce((select array_agg(pp.storage_path order by pp.sort_order) from public.profile_photos pp where pp.user_id=pr.user_id), '{}'::text[]) as photo_list,
      (
        (case when p_gender is not null and pr.gender=p_gender then 1 else 0 end) +
        (case when p_intention is not null and p_intention=any(pr.intentions) then 1 else 0 end) +
        (case when p_interest is not null and exists(select 1 from public.user_interests ui where ui.user_id=pr.user_id and ui.interest_name ilike '%'||p_interest||'%') then 1 else 0 end) +
        (case when p_city is not null and pr.show_city and pr.city ilike '%'||p_city||'%' then 1 else 0 end) +
        (case when p_education is not null and pr.education=p_education then 1 else 0 end) +
        (case when p_exercise is not null and pr.exercise_frequency=p_exercise then 1 else 0 end)
      )::integer as score
    from public.profiles pr
    where pr.user_id <> v_uid
      and extract(year from age(current_date, pr.birth_date)) between p_min_age and p_max_age
      and (not p_photos_only or exists(select 1 from public.profile_photos pp where pp.user_id=pr.user_id))
      and not exists(select 1 from public.user_blocks b where (b.blocker_id=v_uid and b.blocked_id=pr.user_id) or (b.blocker_id=pr.user_id and b.blocked_id=v_uid))
  )
  select c.user_id, c.display_name, c.public_age, c.gender, c.bio, c.public_city,
    c.education, c.intentions, c.interest_list, c.photo_list, c.score
  from candidates c
  where not p_strict or c.score =
    ((p_gender is not null)::integer + (p_intention is not null)::integer +
     (p_interest is not null)::integer + (p_city is not null)::integer +
     (p_education is not null)::integer + (p_exercise is not null)::integer)
  order by c.score desc, c.display_name
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.discover_profiles(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) from public;
grant execute on function public.discover_profiles(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) to authenticated;

-- A chave publishable/anon pode ser usada no navegador. A service_role/secret
-- NUNCA deve ser inserida no frontend, no GitHub ou em aplicativos distribuídos.