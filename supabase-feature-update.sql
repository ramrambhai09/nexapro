-- NexaProm feature update: trending badge + likes
-- Run this once in Supabase SQL Editor.

alter table public.prompt_cards
add column if not exists trending boolean not null default false;

create table if not exists public.prompt_likes (
  prompt_id text primary key,
  like_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.prompt_likes enable row level security;

grant select, insert, update on public.prompt_likes to anon, authenticated;

drop policy if exists "Public can read prompt likes" on public.prompt_likes;
create policy "Public can read prompt likes"
on public.prompt_likes for select
to anon, authenticated
using (true);

drop policy if exists "Public can insert prompt likes" on public.prompt_likes;
create policy "Public can insert prompt likes"
on public.prompt_likes for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update prompt likes" on public.prompt_likes;
create policy "Public can update prompt likes"
on public.prompt_likes for update
to anon, authenticated
using (true)
with check (true);
