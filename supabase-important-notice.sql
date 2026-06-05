-- nexapro important moving notice setup
-- Run this in Supabase SQL Editor once.

create table if not exists public.important_notice (
  id int primary key default 1,
  message text not null default '',
  updated_at timestamptz not null default now(),
  constraint important_notice_single_row check (id = 1)
);

alter table public.important_notice enable row level security;

grant select on public.important_notice to anon, authenticated;
grant insert, update, delete on public.important_notice to authenticated;

drop policy if exists "Public can read important notice" on public.important_notice;
create policy "Public can read important notice"
on public.important_notice
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can insert important notice" on public.important_notice;
create policy "Authenticated can insert important notice"
on public.important_notice
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update important notice" on public.important_notice;
create policy "Authenticated can update important notice"
on public.important_notice
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete important notice" on public.important_notice;
create policy "Authenticated can delete important notice"
on public.important_notice
for delete
to authenticated
using (true);

-- Default notice. You can change/delete it from admin panel.
insert into public.important_notice (id, message, updated_at)
values (
  1,
  'Important: The name shown in any sample image can be replaced in the prompt with your own name before generating your photo.',
  now()
)
on conflict (id) do nothing;

do $$
begin
  begin
    alter publication supabase_realtime add table public.important_notice;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
