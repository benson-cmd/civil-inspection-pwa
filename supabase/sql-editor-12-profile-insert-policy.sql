-- 12. Allow allowlisted Google users to create their own profile on first login.

drop policy if exists "ci_profiles_insert_self_allowed" on public.ci_profiles;
create policy "ci_profiles_insert_self_allowed"
on public.ci_profiles for insert
to authenticated
with check (
  id = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and exists (
    select 1
    from public.ci_allowed_users
    where lower(ci_allowed_users.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and ci_allowed_users.role = ci_profiles.role
  )
);

insert into public.ci_profiles (id, email, name, role)
select
  auth.users.id,
  lower(auth.users.email),
  coalesce(public.ci_allowed_users.name, auth.users.email),
  public.ci_allowed_users.role
from auth.users
join public.ci_allowed_users
  on lower(public.ci_allowed_users.email) = lower(auth.users.email)
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  updated_at = now();
