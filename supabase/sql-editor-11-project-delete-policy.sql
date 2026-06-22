-- 11. Allow project owners/admins to delete cases.

drop policy if exists "ci_projects_delete_owner_or_admin" on public.ci_projects;
create policy "ci_projects_delete_owner_or_admin"
on public.ci_projects for delete
to authenticated
using (
  owner_id = auth.uid()
  or app_private.ci_is_admin()
  or exists (
    select 1
    from public.ci_project_members
    where ci_project_members.project_id = ci_projects.id
      and ci_project_members.user_id = auth.uid()
      and ci_project_members.role = 'admin'
  )
);
