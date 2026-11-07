-- BRAZILLY: perfis privados e fotos protegidas
-- Execute depois de profile-social-basics.sql, messaging.sql e friend-requests.sql.
-- Esta migração converte o bucket de fotos de perfil para privado.
-- As imagens antigas permanecem no Storage, mas deixam de ser acessíveis por URL pública.

alter table public.profiles
 add column if not exists private_profile boolean not null default false;

create or replace function public.can_view_profile(p_profile_user_id uuid)
returns boolean language sql stable security definer set search_path=public
as $can_view_profile$
 select auth.uid() is not null
 and p_profile_user_id is not null
 and not public.is_blocked_between(auth.uid(),p_profile_user_id)
 and (
  auth.uid()=p_profile_user_id
  or exists(select 1 from public.profiles p where p.user_id=p_profile_user_id and p.private_profile=false)
  or exists(
   select 1 from public.friend_requests fr
   where fr.status='accepted'
    and fr.user_one=least(auth.uid(),p_profile_user_id)
    and fr.user_two=greatest(auth.uid(),p_profile_user_id)
  )
 );
$can_view_profile$;
revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated;

update storage.buckets set public=false where id='profile-photos';
drop policy if exists "profile_photos_public_read" on storage.objects;
drop policy if exists "profile_photos_private_read" on storage.objects;
create policy "profile_photos_private_read" on storage.objects
for select to authenticated using (
 bucket_id='profile-photos'
 and public.can_view_profile((storage.foldername(name))[1]::uuid)
);

-- Mantém a mesma assinatura da RPC v2, adicionando o filtro de privacidade.
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
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Autenticação necessária.'; end if;
 if p_min_age<18 or p_max_age<p_min_age or p_max_age>120 then raise exception 'Faixa etária inválida.'; end if;
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
   and public.can_view_profile(pr.user_id)
   and (not p_photos_only or exists(select 1 from public.profile_photos pp where pp.user_id=pr.user_id))
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

-- Impede novas conversas iniciadas por quem não tem acesso a um perfil privado.
create or replace function public.get_or_create_conversation(p_other_user uuid)
returns uuid language plpgsql security definer set search_path=public
as $get_or_create_conversation$
declare v_me uuid:=auth.uid();v_one uuid;v_two uuid;v_id uuid;
begin
 if v_me is null then raise exception 'Entre na sua conta para iniciar uma conversa.'; end if;
 if p_other_user is null or p_other_user=v_me then raise exception 'Perfil de destino inválido.'; end if;
 if not exists(select 1 from public.profiles where user_id=p_other_user) then raise exception 'Esse perfil não está disponível.'; end if;
 if not public.can_view_profile(p_other_user) then raise exception 'Este perfil é privado. Somente amigos aceitos podem iniciar uma conversa.'; end if;
 v_one:=least(v_me,p_other_user);v_two:=greatest(v_me,p_other_user);
 insert into public.conversations(user_one,user_two) values(v_one,v_two) on conflict(user_one,user_two) do nothing;
 select id into v_id from public.conversations where user_one=v_one and user_two=v_two;
 return v_id;
end;
$get_or_create_conversation$;
revoke all on function public.get_or_create_conversation(uuid) from public;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

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
 if v_other is null or not public.can_view_profile(v_other) then raise exception 'Conversa ou perfil indisponível.'; end if;
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
