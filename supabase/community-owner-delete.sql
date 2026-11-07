-- Allow only a community's original creator to delete it.
-- Related members, messages, reads, and polls are removed by existing ON DELETE CASCADE constraints.
grant delete on public.communities to authenticated;
drop policy if exists communities_delete_creator on public.communities;
create policy communities_delete_creator
on public.communities
for delete
to authenticated
using (created_by = (select auth.uid()));
