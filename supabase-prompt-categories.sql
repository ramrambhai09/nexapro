-- nexaprom prompt categories setup
create extension if not exists pgcrypto;
create table if not exists public.prompt_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prompt_categories enable row level security;
grant select on public.prompt_categories to anon, authenticated;
grant insert, update, delete on public.prompt_categories to authenticated;
drop policy if exists "Public can read prompt categories" on public.prompt_categories;
create policy "Public can read prompt categories" on public.prompt_categories for select to anon, authenticated using (true);
drop policy if exists "Authenticated can insert prompt categories" on public.prompt_categories;
create policy "Authenticated can insert prompt categories" on public.prompt_categories for insert to authenticated with check (true);
drop policy if exists "Authenticated can update prompt categories" on public.prompt_categories;
create policy "Authenticated can update prompt categories" on public.prompt_categories for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated can delete prompt categories" on public.prompt_categories;
create policy "Authenticated can delete prompt categories" on public.prompt_categories for delete to authenticated using (true);
insert into public.prompt_categories (name) values ('Male'),('Female') on conflict (name) do nothing;
do $$ begin
  begin alter publication supabase_realtime add table public.prompt_categories;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
