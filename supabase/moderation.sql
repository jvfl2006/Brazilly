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
