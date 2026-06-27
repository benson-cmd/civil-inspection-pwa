-- 23. Fix project creation for authorized non-admin users.
-- Required when a normal user can sign in but gets:
-- ERROR 42501: new row violates row-level security policy for table "ci_projects"

alter table public.ci_projects enable row level security;
alter table public.ci_project_members enable row level security;

create or replace function app_private.ci_can_manage_project_members(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select app_private.ci_is_admin()
    or exists (
      select 1
      from public.ci_projects
      where ci_projects.id = project_uuid
        and ci_projects.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.ci_project_members
      where ci_project_members.project_id = project_uuid
        and ci_project_members.user_id = auth.uid()
        and ci_project_members.role = 'admin'
    );
$$;

drop policy if exists "ci_projects_insert_authenticated" on public.ci_projects;
create policy "ci_projects_insert_authenticated"
on public.ci_projects for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.ci_profiles
    where ci_profiles.id = auth.uid()
  )
);

drop policy if exists "ci_projects_update_members" on public.ci_projects;
create policy "ci_projects_update_members"
on public.ci_projects for update
to authenticated
using (
  app_private.ci_can_access_project(id)
)
with check (
  app_private.ci_can_access_project(id)
);

drop policy if exists "ci_project_members_insert_project_owner" on public.ci_project_members;
create policy "ci_project_members_insert_project_owner"
on public.ci_project_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ci_projects
    where ci_projects.id = ci_project_members.project_id
      and ci_projects.owner_id = auth.uid()
  )
);

drop policy if exists "ci_project_members_update_project_owner_or_case_admin" on public.ci_project_members;
create policy "ci_project_members_update_project_owner_or_case_admin"
on public.ci_project_members for update
to authenticated
using (app_private.ci_can_manage_project_members(project_id))
with check (app_private.ci_can_manage_project_members(project_id));

drop policy if exists "ci_project_members_delete_project_owner_or_case_admin" on public.ci_project_members;
create policy "ci_project_members_delete_project_owner_or_case_admin"
on public.ci_project_members for delete
to authenticated
using (app_private.ci_can_manage_project_members(project_id));
