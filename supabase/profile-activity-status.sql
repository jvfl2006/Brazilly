alter table public.profiles
  add column if not exists activity_status text not null default 'available',
  add column if not exists activity_note text,
  add column if not exists activity_updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_activity_status_check;
alter table public.profiles add constraint profiles_activity_status_check
  check (activity_status in ('available','chatting','gaming','studying','busy','offline'));

alter table public.profiles drop constraint if exists profiles_activity_note_check;
alter table public.profiles add constraint profiles_activity_note_check
  check (activity_note is null or char_length(activity_note) <= 80);

create or replace function public.discover_profiles_v3(
  p_min_age integer default 18, p_max_age integer default 99, p_gender text default null,
  p_intention text default null, p_interest text default null, p_city text default null,
  p_education text default null, p_exercise text default null, p_photos_only boolean default false,
  p_strict boolean default false, p_limit integer default 40
)
returns table(
  user_id uuid, display_name text, age integer, gender text, bio text, city text, education text,
  intentions text[], interests text[], photo_paths text[], match_score integer, profession text,
  religion text, relationship_status text, activity_status text, activity_note text,
  activity_updated_at timestamptz
)
language plpgsql security definer set search_path = public, extensions
as $function$
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
      pr.activity_status,pr.activity_note,pr.activity_updated_at,
      coalesce((select array_agg(ui.interest_name order by ui.interest_name) from public.user_interests ui where ui.user_id=pr.user_id),'{}'::text[]) interest_list,
      coalesce((select array_agg(pp.storage_path order by pp.sort_order) from public.profile_photos pp where pp.user_id=pr.user_id),'{}'::text[]) photo_list,
      ((case when p_gender is not null and pr.gender=p_gender then 1 else 0 end)+
       (case when p_intention is not null and p_intention=any(pr.intentions) then 1 else 0 end)+
       (case when p_interest is not null and exists(select 1 from public.user_interests ui where ui.user_id=pr.user_id and ui.interest_name ilike '%'||p_interest||'%') then 1 else 0 end)+
       (case when p_city is not null and pr.show_city and pr.city ilike '%'||p_city||'%' then 1 else 0 end)+
       (case when p_education is not null and pr.education=p_education then 1 else 0 end)+
       (case when p_exercise is not null and pr.exercise_frequency=p_exercise then 1 else 0 end))::integer score
    from public.profiles pr
    where pr.user_id<>v_uid and extract(year from age(current_date,pr.birth_date)) between p_min_age and p_max_age
      and public.can_view_profile(pr.user_id)
      and (not p_photos_only or exists(select 1 from public.profile_photos pp where pp.user_id=pr.user_id))
  )
  select c.user_id,c.display_name,c.public_age,c.gender,c.bio,c.public_city,c.education,c.intentions,
    c.interest_list,c.photo_list,c.score,c.profession,c.religion,c.relationship_status,
    c.activity_status,c.activity_note,c.activity_updated_at
  from candidates c
  where not p_strict or c.score=((p_gender is not null)::integer+(p_intention is not null)::integer+
    (p_interest is not null)::integer+(p_city is not null)::integer+(p_education is not null)::integer+
    (p_exercise is not null)::integer)
  order by c.score desc,c.display_name limit greatest(1,least(p_limit,100));
end;
$function$;

revoke all on function public.discover_profiles_v3(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) from public, anon;
grant execute on function public.discover_profiles_v3(integer,integer,text,text,text,text,text,text,boolean,boolean,integer) to authenticated;
