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
