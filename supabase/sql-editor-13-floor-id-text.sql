-- Fix attachment seven floor persistence.
-- The app uses deterministic floor ids like:
--   <target_id>__floor-1F
-- so ci_floors.id and ci_inspection_points.floor_id must be text, not uuid.
-- Also allow custom floor names beyond 1F/2F/3F/RF.

begin;

drop policy if exists "ci_floors_project_members" on public.ci_floors;
drop policy if exists "ci_inspection_points_project_members" on public.ci_inspection_points;
drop policy if exists "ci_photos_project_members" on public.ci_photos;

alter table public.ci_photos
  drop constraint if exists ci_photos_point_id_fkey;

alter table public.ci_inspection_points
  drop constraint if exists ci_inspection_points_floor_id_fkey;

alter table public.ci_floors
  drop constraint if exists ci_floors_floor_name_check;

alter table public.ci_floors
  alter column id type text using id::text;

alter table public.ci_inspection_points
  alter column floor_id type text using floor_id::text;

alter table public.ci_inspection_points
  add constraint ci_inspection_points_floor_id_fkey
  foreign key (floor_id) references public.ci_floors(id) on delete cascade;

alter table public.ci_photos
  add constraint ci_photos_point_id_fkey
  foreign key (point_id) references public.ci_inspection_points(id) on delete cascade;

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

commit;
