-- 02. Create Civil Inspection PWA auth trigger and RLS policies.
-- Run this after 01-create-ci-tables succeeds.

create or replace function app_private.ci_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ci_profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function app_private.ci_can_access_project(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select app_private.ci_is_admin()
    or exists (
      select 1
      from public.ci_project_members
      where project_id = project_uuid
        and user_id = auth.uid()
    );
$$;

create or replace function app_private.ci_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ci_profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'user'
  )
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.ci_profiles.name, excluded.name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists ci_on_auth_user_created on auth.users;
create trigger ci_on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.ci_handle_new_user();

alter table public.ci_profiles enable row level security;
alter table public.ci_projects enable row level security;
alter table public.ci_project_members enable row level security;
alter table public.ci_report_sections enable row level security;
alter table public.ci_attachments enable row level security;
alter table public.ci_targets enable row level security;
alter table public.ci_floors enable row level security;
alter table public.ci_inspection_points enable row level security;
alter table public.ci_photos enable row level security;
alter table public.ci_site_photos enable row level security;

drop policy if exists "ci_profiles_select_self_or_admin" on public.ci_profiles;
create policy "ci_profiles_select_self_or_admin"
on public.ci_profiles for select
to authenticated
using (id = auth.uid() or app_private.ci_is_admin());

drop policy if exists "ci_profiles_update_self_or_admin" on public.ci_profiles;
create policy "ci_profiles_update_self_or_admin"
on public.ci_profiles for update
to authenticated
using (id = auth.uid() or app_private.ci_is_admin())
with check (id = auth.uid() or app_private.ci_is_admin());

drop policy if exists "ci_projects_select_members" on public.ci_projects;
create policy "ci_projects_select_members"
on public.ci_projects for select
to authenticated
using (app_private.ci_can_access_project(id));

drop policy if exists "ci_projects_insert_authenticated" on public.ci_projects;
create policy "ci_projects_insert_authenticated"
on public.ci_projects for insert
to authenticated
with check (owner_id = auth.uid() or app_private.ci_is_admin());

drop policy if exists "ci_projects_update_members" on public.ci_projects;
create policy "ci_projects_update_members"
on public.ci_projects for update
to authenticated
using (app_private.ci_can_access_project(id))
with check (app_private.ci_can_access_project(id));

drop policy if exists "ci_project_members_select_members" on public.ci_project_members;
create policy "ci_project_members_select_members"
on public.ci_project_members for select
to authenticated
using (app_private.ci_can_access_project(project_id));

drop policy if exists "ci_project_members_manage_admin" on public.ci_project_members;
create policy "ci_project_members_manage_admin"
on public.ci_project_members for all
to authenticated
using (app_private.ci_is_admin())
with check (app_private.ci_is_admin());

drop policy if exists "ci_report_sections_project_members" on public.ci_report_sections;
create policy "ci_report_sections_project_members"
on public.ci_report_sections for all
to authenticated
using (app_private.ci_can_access_project(project_id))
with check (app_private.ci_can_access_project(project_id));

drop policy if exists "ci_attachments_project_members" on public.ci_attachments;
create policy "ci_attachments_project_members"
on public.ci_attachments for all
to authenticated
using (app_private.ci_can_access_project(project_id))
with check (app_private.ci_can_access_project(project_id));

drop policy if exists "ci_targets_project_members" on public.ci_targets;
create policy "ci_targets_project_members"
on public.ci_targets for all
to authenticated
using (app_private.ci_can_access_project(project_id))
with check (app_private.ci_can_access_project(project_id));

drop policy if exists "ci_floors_project_members" on public.ci_floors;
create policy "ci_floors_project_members"
on public.ci_floors for all
to authenticated
using (
  exists (
    select 1
    from public.ci_targets
    where ci_targets.id = ci_floors.target_id
      and app_private.ci_can_access_project(ci_targets.project_id)
  )
)
with check (
  exists (
    select 1
    from public.ci_targets
    where ci_targets.id = ci_floors.target_id
      and app_private.ci_can_access_project(ci_targets.project_id)
  )
);

drop policy if exists "ci_inspection_points_project_members" on public.ci_inspection_points;
create policy "ci_inspection_points_project_members"
on public.ci_inspection_points for all
to authenticated
using (
  exists (
    select 1
    from public.ci_floors
    join public.ci_targets on ci_targets.id = ci_floors.target_id
    where ci_floors.id = ci_inspection_points.floor_id
      and app_private.ci_can_access_project(ci_targets.project_id)
  )
)
with check (
  exists (
    select 1
    from public.ci_floors
    join public.ci_targets on ci_targets.id = ci_floors.target_id
    where ci_floors.id = ci_inspection_points.floor_id
      and app_private.ci_can_access_project(ci_targets.project_id)
  )
);

drop policy if exists "ci_photos_project_members" on public.ci_photos;
create policy "ci_photos_project_members"
on public.ci_photos for all
to authenticated
using (
  exists (
    select 1
    from public.ci_inspection_points
    join public.ci_floors on ci_floors.id = ci_inspection_points.floor_id
    join public.ci_targets on ci_targets.id = ci_floors.target_id
    where ci_inspection_points.id = ci_photos.point_id
      and app_private.ci_can_access_project(ci_targets.project_id)
  )
)
with check (
  exists (
    select 1
    from public.ci_inspection_points
    join public.ci_floors on ci_floors.id = ci_inspection_points.floor_id
    join public.ci_targets on ci_targets.id = ci_floors.target_id
    where ci_inspection_points.id = ci_photos.point_id
      and app_private.ci_can_access_project(ci_targets.project_id)
  )
);

drop policy if exists "ci_site_photos_project_members" on public.ci_site_photos;
create policy "ci_site_photos_project_members"
on public.ci_site_photos for all
to authenticated
using (app_private.ci_can_access_project(project_id))
with check (app_private.ci_can_access_project(project_id));
