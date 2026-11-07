-- Central da Comunidade: feed público de novidades e sugestões com apoio da comunidade.
create table if not exists public.brazilly_updates (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 4 and 120),
 body text not null check (char_length(btrim(body)) between 10 and 5000),
 update_type text not null check (update_type in ('feature','improvement','fix','in_progress','consideration')),
 published boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists brazilly_updates_published_created_idx on public.brazilly_updates(published,created_at desc);
create table if not exists public.community_suggestions (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 5 and 120),
 description text not null check (char_length(btrim(description)) between 10 and 3000),
 category text not null default 'other' check (category in ('feature','improvement','design','community','other')),
 status text not null default 'received' check (status in ('received','reviewing','planned','implemented','declined')),
 moderator_response text check (moderator_response is null or char_length(moderator_response) <= 2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists community_suggestions_status_created_idx on public.community_suggestions(status,created_at desc);
create index if not exists community_suggestions_author_idx on public.community_suggestions(author_id,created_at desc);
create table if not exists public.community_suggestion_votes (
 suggestion_id uuid not null references public.community_suggestions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(suggestion_id,user_id)
);
create index if not exists community_suggestion_votes_user_idx on public.community_suggestion_votes(user_id,suggestion_id);
alter table public.brazilly_updates enable row level security;
alter table public.community_suggestions enable row level security;
alter table public.community_suggestion_votes enable row level security;
drop policy if exists "Published Brazilly updates are public" on public.brazilly_updates;
create policy "Published Brazilly updates are public" on public.brazilly_updates for select to anon,authenticated using (published=true or (select public.is_brazilly_moderator()));
drop policy if exists "Moderators manage Brazilly updates" on public.brazilly_updates;
create policy "Moderators manage Brazilly updates" on public.brazilly_updates for all to authenticated using ((select public.is_brazilly_moderator())) with check ((select public.is_brazilly_moderator()));
drop policy if exists "Community suggestions are public" on public.community_suggestions;
create policy "Community suggestions are public" on public.community_suggestions for select to anon,authenticated using (true);
drop policy if exists "Signed-in users submit suggestions as themselves" on public.community_suggestions;
create policy "Signed-in users submit suggestions as themselves" on public.community_suggestions for insert to authenticated with check ((select auth.uid())=author_id);
drop policy if exists "Moderators manage community suggestions" on public.community_suggestions;
create policy "Moderators manage community suggestions" on public.community_suggestions for update to authenticated using ((select public.is_brazilly_moderator())) with check ((select public.is_brazilly_moderator()));
drop policy if exists "Suggestion votes are publicly readable" on public.community_suggestion_votes;
create policy "Suggestion votes are publicly readable" on public.community_suggestion_votes for select to anon,authenticated using (true);
drop policy if exists "Users vote as themselves" on public.community_suggestion_votes;
create policy "Users vote as themselves" on public.community_suggestion_votes for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users remove their own votes" on public.community_suggestion_votes;
create policy "Users remove their own votes" on public.community_suggestion_votes for delete to authenticated using ((select auth.uid())=user_id);
grant select on public.brazilly_updates to anon,authenticated;
grant insert,update,delete on public.brazilly_updates to authenticated;
grant select on public.community_suggestions to anon,authenticated;
grant insert,update on public.community_suggestions to authenticated;
grant select on public.community_suggestion_votes to anon,authenticated;
grant insert,delete on public.community_suggestion_votes to authenticated;

-- Não expor os UUIDs de quem apoiou uma sugestão. A função retorna somente
-- contagem agregada e se o usuário atual já votou.
create or replace function public.get_community_suggestion_vote_counts()
returns table(suggestion_id uuid, vote_count bigint, has_voted boolean)
language sql
security definer
set search_path = ''
as $$
 select s.id, count(v.user_id)::bigint,
        coalesce(bool_or(v.user_id = (select auth.uid())), false)
 from public.community_suggestions s
 left join public.community_suggestion_votes v on v.suggestion_id = s.id
 group by s.id;
$$;
revoke all on function public.get_community_suggestion_vote_counts() from public;
grant execute on function public.get_community_suggestion_vote_counts() to anon, authenticated;
drop policy if exists "Suggestion votes are publicly readable" on public.community_suggestion_votes;
drop policy if exists "Users read their own votes" on public.community_suggestion_votes;
create policy "Users read their own votes" on public.community_suggestion_votes
 for select to authenticated using ((select auth.uid()) = user_id);
revoke select on public.community_suggestion_votes from anon, authenticated;
