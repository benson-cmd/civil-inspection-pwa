-- 24. Allow collaborators to see profile names/emails of members in the same case.
-- Fixes collaborator list showing only UUID / "尚未取得 Email".

alter table public.ci_profiles enable row level security;

drop policy if exists "ci_profiles_select_same_project_members" on public.ci_profiles;
create policy "ci_profiles_select_same_project_members"
on public.ci_profiles for select
to authenticated
using (
  id = auth.uid()
  or app_private.ci_is_admin()
  or exists (
    select 1
    from public.ci_project_members current_member
    join public.ci_project_members target_member
      on target_member.project_id = current_member.project_id
    where current_member.user_id = auth.uid()
      and target_member.user_id = ci_profiles.id
  )
);

-- Backfill profiles for already-authorized Google users if they have logged in before.
insert into public.ci_profiles (id, email, name, role)
select
  auth.users.id,
  lower(auth.users.email),
  coalesce(public.ci_allowed_users.name, auth.users.raw_user_meta_data ->> 'name', auth.users.email),
  public.ci_allowed_users.role
from auth.users
join public.ci_allowed_users
  on lower(public.ci_allowed_users.email) = lower(auth.users.email)
where auth.users.email is not null
on conflict (id) do update
set
  email = excluded.email,
  name = coalesce(public.ci_profiles.name, excluded.name),
  role = excluded.role,
  updated_at = now();
