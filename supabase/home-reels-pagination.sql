drop function if exists public.get_home_posts(integer);

create or replace function public.get_home_posts(
  p_limit integer default 10,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table(
  id uuid,
  user_id uuid,
  display_name text,
  caption text,
  filter_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta.';
  end if;

  return query
  select p.id, p.user_id, pr.display_name, p.caption, p.filter_name, p.created_at
  from public.posts p
  join public.profiles pr on pr.user_id = p.user_id
  where public.can_view_profile(p.user_id)
    and not public.is_blocked_between(auth.uid(), p.user_id)
    and (
      p_before_created_at is null
      or (p.created_at, p.id) < (p_before_created_at, p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit greatest(1, least(p_limit, 30));
end;
$function$;

grant execute on function public.get_home_posts(integer, timestamptz, uuid) to authenticated;