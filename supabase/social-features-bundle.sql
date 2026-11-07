-- BRAZILLY: pacote consolidado de recursos sociais
-- Execute este arquivo UMA vez no Supabase SQL Editor.
-- Pré-requisitos: schema.sql e messaging.sql já executados com sucesso.
-- Inclui campos sociais, favoritos, apelidos, wallpapers, perfil pelo chat,
-- mídia/áudio, pedidos de amizade, moderação e perfis privados.
-- A execução é aditiva e pode ser repetida: não apaga contas, perfis ou mensagens.
-- Execute o INSERT de administrador comentado na seção de moderação ao final,
-- substituindo pelo UUID da sua conta, para habilitar o painel de denúncias.



-- ==========================================================
-- MIGRAÇÃO 1: supabase/profile-social-basics.sql
-- ==========================================================

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


-- ==========================================================
-- MIGRAÇÃO 2: supabase/conversation-customization.sql
-- ==========================================================

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


-- ==========================================================
-- MIGRAÇÃO 3: supabase/chat-media.sql
-- ==========================================================

-- BRAZILLY: envio de imagens, GIFs, figurinhas e áudios nas mensagens
-- Execute no Supabase SQL Editor depois de messaging.sql.
-- Migração aditiva; mensagens de texto existentes continuam funcionando.

alter table public.messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text','image','audio','gif','sticker')),
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size bigint,
  add column if not exists media_blurred boolean not null default false;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-media','chat-media',false,15728640,
 array['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict(id) do update set public=false,file_size_limit=15728640,
 allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "chat_media_read_participants" on storage.objects;
create policy "chat_media_read_participants" on storage.objects
for select to authenticated using (
 bucket_id='chat-media'
 and exists(
  select 1 from public.conversations c
  where c.id=(storage.foldername(name))[1]::uuid
   and auth.uid() in (c.user_one,c.user_two)
   and not public.is_blocked_between(c.user_one,c.user_two)
 )
);

drop policy if exists "chat_media_upload_sender" on storage.objects;
create policy "chat_media_upload_sender" on storage.objects
for insert to authenticated with check (
 bucket_id='chat-media'
 and (storage.foldername(name))[2]=auth.uid()::text
 and exists(
  select 1 from public.conversations c
  where c.id=(storage.foldername(name))[1]::uuid
   and auth.uid() in (c.user_one,c.user_two)
   and not public.is_blocked_between(c.user_one,c.user_two)
 )
);

drop policy if exists "chat_media_delete_sender" on storage.objects;
create policy "chat_media_delete_sender" on storage.objects
for delete to authenticated using (
 bucket_id='chat-media'
 and (storage.foldername(name))[2]=auth.uid()::text
 and exists(
  select 1 from public.conversations c
  where c.id=(storage.foldername(name))[1]::uuid
   and auth.uid() in (c.user_one,c.user_two)
 )
);



-- ==========================================================
-- MIGRAÇÃO 4: supabase/friend-requests.sql
-- ==========================================================

-- BRAZILLY: pedidos de amizade opcionais
-- Mensagens diretas continuam independentes de amizade.
-- Execute no Supabase SQL Editor depois de schema.sql e messaging.sql.

create table if not exists public.friend_requests (
 id uuid primary key default gen_random_uuid(),
 user_one uuid not null references public.profiles(user_id) on delete cascade,
 user_two uuid not null references public.profiles(user_id) on delete cascade,
 requested_by uuid not null references public.profiles(user_id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint friend_requests_distinct check(user_one<>user_two),
 constraint friend_requests_canonical check(user_one<user_two),
 constraint friend_requests_requester check(requested_by=user_one or requested_by=user_two),
 constraint friend_requests_pair_unique unique(user_one,user_two)
);
create index if not exists friend_requests_pending_user_one_idx on public.friend_requests(user_one,status);
create index if not exists friend_requests_pending_user_two_idx on public.friend_requests(user_two,status);
alter table public.friend_requests enable row level security;
drop policy if exists "friend_requests_select_participants" on public.friend_requests;
create policy "friend_requests_select_participants" on public.friend_requests
 for select to authenticated using(auth.uid() in(user_one,user_two));
grant select on public.friend_requests to authenticated;

create or replace function public.send_friend_request(p_other_user uuid)
returns uuid language plpgsql security definer set search_path=public
as $send_friend_request$
declare v_me uuid:=auth.uid();v_one uuid;v_two uuid;v_id uuid;v_requester uuid;v_status text;
begin
 if v_me is null then raise exception 'Entre na sua conta.'; end if;
 if p_other_user is null or p_other_user=v_me then raise exception 'Usuário inválido.'; end if;
 if not exists(select 1 from public.profiles where user_id=p_other_user) then raise exception 'Perfil indisponível.'; end if;
 if public.is_blocked_between(v_me,p_other_user) then raise exception 'Não é possível enviar pedido para este perfil.'; end if;
 v_one:=least(v_me,p_other_user);v_two:=greatest(v_me,p_other_user);
 select id,requested_by,status into v_id,v_requester,v_status from public.friend_requests
 where user_one=v_one and user_two=v_two;
 if v_id is null then
  insert into public.friend_requests(user_one,user_two,requested_by)
  values(v_one,v_two,v_me) returning id into v_id;
 elsif v_status='accepted' then
  return v_id;
 elsif v_status='pending' and v_requester<>v_me then
  update public.friend_requests set status='accepted',updated_at=now() where id=v_id;
 elsif v_status in('declined','cancelled') then
  update public.friend_requests set requested_by=v_me,status='pending',created_at=now(),updated_at=now() where id=v_id;
 end if;
 return v_id;
end;
$send_friend_request$;

create or replace function public.respond_friend_request(p_request_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path=public
as $respond_friend_request$
declare v_count integer;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 update public.friend_requests set status=case when p_accept then 'accepted' else 'declined' end,updated_at=now()
 where id=p_request_id and auth.uid() in(user_one,user_two) and requested_by<>auth.uid() and status='pending';
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'Pedido não encontrado ou não está mais pendente.'; end if;
 return true;
end;
$respond_friend_request$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public
as $cancel_friend_request$
declare v_count integer;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 update public.friend_requests set status='cancelled',updated_at=now()
 where id=p_request_id and requested_by=auth.uid() and status='pending';
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'Pedido não encontrado ou não pode ser cancelado.'; end if;
 return true;
end;
$cancel_friend_request$;

create or replace function public.get_friendship_status(p_other_user uuid)
returns text language plpgsql stable security definer set search_path=public
as $get_friendship_status$
declare v_id uuid;v_requester uuid;v_status text;
begin
 if auth.uid() is null or p_other_user is null or p_other_user=auth.uid() then return 'none'; end if;
 if public.is_blocked_between(auth.uid(),p_other_user) then return 'blocked'; end if;
 select id,requested_by,status into v_id,v_requester,v_status from public.friend_requests
 where user_one=least(auth.uid(),p_other_user) and user_two=greatest(auth.uid(),p_other_user);
 if v_status='accepted' then return 'friends'; end if;
 if v_status='pending' and v_requester=auth.uid() then return 'sent'; end if;
 if v_status='pending' then return 'received'; end if;
 return 'none';
end;
$get_friendship_status$;

create or replace function public.list_my_friend_requests()
returns table(request_id uuid,requester_id uuid,display_name text,created_at timestamptz)
language sql stable security definer set search_path=public
as $list_my_friend_requests$
 select fr.id,fr.requested_by,p.display_name,fr.created_at
 from public.friend_requests fr join public.profiles p on p.user_id=fr.requested_by
 where auth.uid() in(fr.user_one,fr.user_two)
 and fr.requested_by<>auth.uid() and fr.status='pending'
 order by fr.created_at desc limit 100;
$list_my_friend_requests$;

revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
revoke all on function public.cancel_friend_request(uuid) from public;
revoke all on function public.get_friendship_status(uuid) from public;
revoke all on function public.list_my_friend_requests() from public;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.get_friendship_status(uuid) to authenticated;
grant execute on function public.list_my_friend_requests() to authenticated;


-- ==========================================================
-- MIGRAÇÃO 5: supabase/moderation.sql
-- ==========================================================

-- BRAZILLY: painel seguro de moderação
-- Execute no Supabase SQL Editor.
-- Depois, adicione manualmente o UUID da conta administradora usando o INSERT
-- comentado no final deste arquivo. Não existe promoção automática de usuários.

create table if not exists public.brazilly_moderators (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.brazilly_moderators enable row level security;
revoke all on public.brazilly_moderators from anon,authenticated;

create or replace function public.is_brazilly_moderator()
returns boolean language sql stable security definer set search_path=public
as $is_brazilly_moderator$
 select auth.uid() is not null and exists(
  select 1 from public.brazilly_moderators m where m.user_id=auth.uid()
 );
$is_brazilly_moderator$;

create or replace function public.list_moderation_reports()
returns table(
 report_id uuid,reporter_id uuid,reporter_name text,reported_user_id uuid,
 reported_name text,reason text,details text,status text,created_at timestamptz
)
language plpgsql stable security definer set search_path=public
as $list_moderation_reports$
begin
 if not public.is_brazilly_moderator() then raise exception 'Acesso restrito à moderação.'; end if;
 return query
 select r.id,r.reporter_id,coalesce(reporter.display_name,'Conta removida'),
  r.reported_user_id,coalesce(reported.display_name,'Perfil indisponível'),
  r.reason,r.details,r.status,r.created_at
 from public.user_reports r
 left join public.profiles reporter on reporter.user_id=r.reporter_id
 left join public.profiles reported on reported.user_id=r.reported_user_id
 order by case r.status when 'pending' then 0 when 'reviewing' then 1 else 2 end,r.created_at desc
 limit 500;
end;
$list_moderation_reports$;

create or replace function public.update_moderation_report(p_report_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public
as $update_moderation_report$
declare v_count integer;
begin
 if not public.is_brazilly_moderator() then raise exception 'Acesso restrito à moderação.'; end if;
 if p_status not in ('pending','reviewing','resolved','dismissed') then raise exception 'Status inválido.'; end if;
 update public.user_reports set status=p_status where id=p_report_id;
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'Denúncia não encontrada.'; end if;
 return true;
end;
$update_moderation_report$;

revoke all on function public.is_brazilly_moderator() from public;
revoke all on function public.list_moderation_reports() from public;
revoke all on function public.update_moderation_report(uuid,text) from public;
grant execute on function public.is_brazilly_moderator() to authenticated;
grant execute on function public.list_moderation_reports() to authenticated;
grant execute on function public.update_moderation_report(uuid,text) to authenticated;

-- Para autorizar a conta administradora, localize o UUID em Supabase > Authentication > Users
-- e execute manualmente (substituindo o valor):
-- insert into public.brazilly_moderators(user_id)
-- values ('UUID-DA-CONTA-ADMIN')
-- on conflict do nothing;


-- ==========================================================
-- MIGRAÇÃO 6: supabase/profile-privacy.sql
-- ==========================================================

-- BRAZILLY: perfis privados e fotos protegidas
-- Execute depois de profile-social-basics.sql, messaging.sql e friend-requests.sql.
-- O bucket profile-photos passa a ser privado. Os arquivos antigos são mantidos.

alter table public.profiles add column if not exists private_profile boolean not null default false;

create or replace function public.can_view_profile(p_profile_user_id uuid)
returns boolean language sql stable security definer set search_path=public
as $can_view_profile$
 select auth.uid() is not null and p_profile_user_id is not null
 and not public.is_blocked_between(auth.uid(),p_profile_user_id)
 and (
  auth.uid()=p_profile_user_id
  or exists(select 1 from public.profiles p where p.user_id=p_profile_user_id and p.private_profile=false)
  or exists(select 1 from public.friend_requests fr where fr.status='accepted'
   and fr.user_one=least(auth.uid(),p_profile_user_id)
   and fr.user_two=greatest(auth.uid(),p_profile_user_id))
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
