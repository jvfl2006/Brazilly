create or replace function public.get_conversation_avatars(p_user_ids uuid[])
returns table(user_id uuid, storage_path text)
language sql stable security definer set search_path = public
as $function$
 select pp.user_id,pp.storage_path from public.profile_photos pp
 where pp.user_id=any(coalesce(p_user_ids,'{}'::uuid[])) and pp.is_primary=true and auth.uid() is not null
 and exists(select 1 from public.conversations c where auth.uid() in(c.user_one,c.user_two)
 and pp.user_id in(c.user_one,c.user_two) and pp.user_id<>auth.uid()
 and not public.is_blocked_between(c.user_one,c.user_two));
$function$;
revoke all on function public.get_conversation_avatars(uuid[]) from public,anon;
grant execute on function public.get_conversation_avatars(uuid[]) to authenticated;
