alter table public.messages
  add column if not exists story_id uuid references public.stories(id) on delete set null;

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type = any (array['text','image','audio','gif','sticker','story_reply']::text[]));

create index if not exists messages_story_id_idx
  on public.messages(story_id)
  where story_id is not null;

comment on column public.messages.story_id is
  'Story original referenced by a Direct reply; story content remains protected by stories RLS and Storage policies.';
