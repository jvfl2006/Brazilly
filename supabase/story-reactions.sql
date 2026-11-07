-- Reações aos stories: cada pessoa mantém uma reação por story.
create table if not exists public.story_reactions (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('❤️','😂','🔥','👏','😮')),
  created_at timestamptz not null default now(),
  primary key (story_id,user_id)
);
alter table public.story_reactions enable row level security;
drop policy if exists story_reactions_read_visible on public.story_reactions;
create policy story_reactions_read_visible on public.story_reactions
  for select to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = story_reactions.story_id
      and s.expires_at > now()
      and public.can_view_story(s.user_id,s.audience)
  ));
drop policy if exists story_reactions_insert_self on public.story_reactions;
create policy story_reactions_insert_self on public.story_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_reactions.story_id
        and s.user_id <> (select auth.uid())
        and s.expires_at > now()
        and public.can_view_story(s.user_id,s.audience)
    )
  );
drop policy if exists story_reactions_update_self on public.story_reactions;
create policy story_reactions_update_self on public.story_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_reactions.story_id
        and s.user_id <> (select auth.uid())
        and s.expires_at > now()
        and public.can_view_story(s.user_id,s.audience)
    )
  );
drop policy if exists story_reactions_delete_self on public.story_reactions;
create policy story_reactions_delete_self on public.story_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));
grant select,insert,update,delete on public.story_reactions to authenticated;
