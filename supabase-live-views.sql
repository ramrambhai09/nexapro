-- nexapro live visit counter setup - final working version
-- Run this full code once in Supabase SQL Editor.

create table if not exists public.site_views (
  id int primary key default 1,
  view_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint site_views_single_row check (id = 1)
);

insert into public.site_views (id, view_count)
values (1, 0)
on conflict (id) do nothing;

alter table public.site_views enable row level security;

drop policy if exists "Public can read site views" on public.site_views;
create policy "Public can read site views"
on public.site_views
for select
to anon, authenticated
using (true);

create or replace function public.increment_site_views()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  insert into public.site_views (id, view_count, updated_at)
  values (1, 1, now())
  on conflict (id)
  do update set
    view_count = public.site_views.view_count + 1,
    updated_at = now()
  returning view_count into new_count;

  return new_count;
end;
$$;

grant select on public.site_views to anon, authenticated;
grant execute on function public.increment_site_views() to anon, authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.site_views;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
