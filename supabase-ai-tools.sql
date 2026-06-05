-- nexapro AI tools setup
-- Run this in Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.ai_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '✨',
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_tools enable row level security;

grant select on public.ai_tools to anon, authenticated;
grant insert, update, delete on public.ai_tools to authenticated;

drop policy if exists "Public can read ai tools" on public.ai_tools;
create policy "Public can read ai tools"
on public.ai_tools
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can insert ai tools" on public.ai_tools;
create policy "Authenticated can insert ai tools"
on public.ai_tools
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update ai tools" on public.ai_tools;
create policy "Authenticated can update ai tools"
on public.ai_tools
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete ai tools" on public.ai_tools;
create policy "Authenticated can delete ai tools"
on public.ai_tools
for delete
to authenticated
using (true);

-- Optional default tools. You can edit/delete them from admin panel.
insert into public.ai_tools (name, icon, url)
values
  ('ChatGPT Image', '🤖', 'https://chatgpt.com'),
  ('Gemini', '✨', 'https://gemini.google.com'),
  ('Leonardo AI', '🎨', 'https://leonardo.ai'),
  ('Ideogram', '🧠', 'https://ideogram.ai'),
  ('Flux', '⚡', 'https://fal.ai/models/flux')
on conflict do nothing;

do $$
begin
  begin
    alter publication supabase_realtime add table public.ai_tools;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
