-- 10. Google OAuth allowlist for system users.
-- Run this once after ci_profiles and policies exist.

create table if not exists public.ci_allowed_users (
  email text primary key,
  name text not null default '',
  role public.ci_user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ci_allowed_users (email, name, role)
select lower(email), coalesce(name, email), role
from public.ci_profiles
where email is not null and email <> ''
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  updated_at = now();

alter table public.ci_allowed_users enable row level security;

drop policy if exists "ci_allowed_users_select_self_or_admin" on public.ci_allowed_users;
create policy "ci_allowed_users_select_self_or_admin"
on public.ci_allowed_users for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or app_private.ci_is_admin()
);

drop policy if exists "ci_allowed_users_insert_admin" on public.ci_allowed_users;
create policy "ci_allowed_users_insert_admin"
on public.ci_allowed_users for insert
to authenticated
with check (app_private.ci_is_admin());

drop policy if exists "ci_allowed_users_update_admin" on public.ci_allowed_users;
create policy "ci_allowed_users_update_admin"
on public.ci_allowed_users for update
to authenticated
using (app_private.ci_is_admin())
with check (app_private.ci_is_admin());

drop policy if exists "ci_allowed_users_delete_admin" on public.ci_allowed_users;
create policy "ci_allowed_users_delete_admin"
on public.ci_allowed_users for delete
to authenticated
using (app_private.ci_is_admin());

grant select, insert, update, delete on public.ci_allowed_users to authenticated;
