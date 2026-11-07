-- BRAZILLY: campos sociais básicos e favoritos
-- Execute no Supabase SQL Editor depois de schema.sql e messaging.sql.
-- Migração aditiva: não apaga tabelas, contas, perfis, fotos ou mensagens.
alter table public.profiles
  add column if not exists profession text check (profession is null or char_length(profession) <= 80),
  add column if not exists religion text check (religion is null or char_length(religion) <= 60),
  add column if not exists relationship_status text check (relationship_status is null or char_length(relationship_status) <= 40);

create table if not exists public.user_favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  target_user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_user_id),
  check (user_id <> target_user_id)
);
create index if not exists user_favorites_target_idx on public.user_favorites(target_user_id);
alter table public.user_favorites enable row level security;
drop policy if exists "favorites_select_own" on public.user_favorites;
create policy "favorites_select_own" on public.user_favorites for select to authenticated using (auth.uid() = user_id);
drop policy if exists "favorites_insert_own" on public.user_favorites;
create policy "favorites_insert_own" on public.user_favorites for insert to authenticated with check (auth.uid() = user_id and user_id <> target_user_id);
drop policy if exists "favorites_delete_own" on public.user_favorites;
create policy "favorites_delete_own" on public.user_favorites for delete to authenticated using (auth.uid() = user_id);
grant select, insert, delete on public.user_favorites to authenticated;

create or replace function public.discover_profiles_v2(
 p_min_age integer default 18,p_max_age integer default 99,p_gender text default null,
 p_intention text default null,p_interest text default null,p_city text default null,
 p_education text default null,p_exercise text default null,p_photos_only boolean default false,
 p_strict boolean default false,p_limit integer default 40
)
returns table(user_id uuid,display_name text,age integer,gender text,bio text,city text,
 education text,intentions text[],interests text[],photo_paths text[],match_score integer,
 profession text,religion text,relationship_status text)
language plpgsql security definer set search_path=public,extensions
as $discover_profiles_v2$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Autenticação necessária.'; end if;
 if p_min_age < 18 or p_max_age < p_min_age or p_max_age > 120 then raise exception 'Faixa etária inválida.'; end if;
 return query
 with candidates as (
  select pr.user_id,pr.display_name,
   case when pr.show_age then extract(year from age(current_date,pr.birth_date))::integer else null end public_age,
   pr.gender,pr.bio,case when pr.show_city then pr.city else null end public_city,
   pr.education,pr.intentions,pr.profession,pr.religion,pr.relationship_status,
   coalesce((select array_agg(ui.interest_name order by ui.interest_name) from public.user_interests ui where ui.user_id=pr.user_id),'{}'::text[]) interest_list,
   coalesce((select array_agg(pp.storage_path order by pp.sort_order) from public.profile_photos pp where pp.user_id=pr.user_id),'{}'::text[]) photo_list,
   ((case when p_gender is not null and pr.gender=p_gender then 1 else 0 end)+
    (case when p_intention is not null and p_intention=any(pr.intentions) then 1 else 0 end)+
    (case when p_interest is not null and exists(select 1 from public.user_interests ui where ui.user_id=pr.user_id and ui.interest_name ilike '%'||p_interest||'%') then 1 else 0 end)+
    (case when p_city is not null and pr.show_city and pr.city ilike '%'||p_city||'%' then 1 else 0 end)+
    (case when p_education is not null and pr.education=p_education then 1 else 0 end)+
    (case when p_exercise is not null and pr.exercise_frequency=p_exercise then 1 else 0 end))::integer score
  from public.profiles pr
  where pr.user_id<>v_uid
   and extract(year from age(current_date,pr.birth_date)) between p_min_age and p_max_age
   and (not p_photos_only or exists(select 1 from public.profile_photos pp where pp.user_id=pr.user_id))
   and not exists(select 1 from public.user_blocks b where (b.blocker_id=v_uid and b.blocked_id=pr.user_id) or (b.blocker_id=pr.user_id and b.blocked_id=v_uid))
 )
 select c.user_id,c.display_name,c.public_age,c.gender,c.bio,c.public_city,c.education,c.intentions,
  c.interest_list,c.photo_list,c.score,c.profession,c.religion,c.relationship_status
 from candidates c
 where not p_strict or c.score=((p_gender is not null)::integer+(p_intention is not null)::integer+
  (p_interest is not null)::integer+(p_city is not null)::integer+(p_education is not null)::integer+
  (p_exercise is not null)::integer)
 order by c.score desc,c.display_name limit greatest(1,least(p_limit,100));
end;
$discover_profiles_v2$;
revoke all on function public.discover_profiles_v2(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) from public;
grant execute on function public.discover_profiles_v2(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) to authenticated;
