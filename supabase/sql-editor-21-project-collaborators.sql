-- 21. Project collaborators.
-- Allows a case owner or case-level admin to add another authorized user as a collaborator.

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

drop policy if exists "ci_project_members_manage_admin" on public.ci_project_members;
create policy "ci_project_members_manage_owner_or_case_admin"
on public.ci_project_members for all
to authenticated
using (app_private.ci_can_manage_project_members(project_id))
with check (app_private.ci_can_manage_project_members(project_id));

drop policy if exists "ci_profiles_select_authenticated_collaborators" on public.ci_profiles;
create policy "ci_profiles_select_authenticated_collaborators"
on public.ci_profiles for select
to authenticated
using (true);

drop policy if exists "ci_allowed_users_select_authenticated_collaborators" on public.ci_allowed_users;
create policy "ci_allowed_users_select_authenticated_collaborators"
on public.ci_allowed_users for select
to authenticated
using (true);
