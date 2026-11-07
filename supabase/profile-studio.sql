create table if not exists public.profile_customizations (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 settings jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint profile_customizations_settings_object check (jsonb_typeof(settings)='object')
);
alter table public.profile_customizations enable row level security;
drop policy if exists profile_customizations_select_visible on public.profile_customizations;
create policy profile_customizations_select_visible on public.profile_customizations for select to authenticated using (user_id=(select auth.uid()) or public.can_view_profile(user_id));
drop policy if exists profile_customizations_insert_own on public.profile_customizations;
create policy profile_customizations_insert_own on public.profile_customizations for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists profile_customizations_update_own on public.profile_customizations;
create policy profile_customizations_update_own on public.profile_customizations for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select,insert,update on public.profile_customizations to authenticated;