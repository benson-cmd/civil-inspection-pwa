-- 08. Persist attachment five/six data and allow inspection photo storage uploads.
-- Run this once in Supabase SQL Editor.

create table if not exists public.ci_level_measurements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  row_order integer not null default 1,
  point_no text,
  location text,
  initial_elevation numeric(12, 3),
  repeat_elevation numeric(12, 3),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ci_tilt_measurements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  row_order integer not null default 1,
  line_no text,
  location text,
  direction text not null default 'X向',
  upper_distance numeric(12, 2),
  lower_distance numeric(12, 2),
  floor_height numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_tilt_measurements_direction_check check (direction in ('X向', 'Y向'))
);

create index if not exists ci_level_measurements_project_id_idx
  on public.ci_level_measurements(project_id, row_order);

create index if not exists ci_tilt_measurements_project_id_idx
  on public.ci_tilt_measurements(project_id, row_order);

alter table public.ci_level_measurements enable row level security;
alter table public.ci_tilt_measurements enable row level security;

drop policy if exists "ci_level_measurements_project_members" on public.ci_level_measurements;
create policy "ci_level_measurements_project_members"
on public.ci_level_measurements for all
to authenticated
using (app_private.ci_can_access_project(project_id))
with check (app_private.ci_can_access_project(project_id));

drop policy if exists "ci_tilt_measurements_project_members" on public.ci_tilt_measurements;
create policy "ci_tilt_measurements_project_members"
on public.ci_tilt_measurements for all
to authenticated
using (app_private.ci_can_access_project(project_id))
with check (app_private.ci_can_access_project(project_id));

grant select, insert, update, delete on public.ci_level_measurements to authenticated;
grant select, insert, update, delete on public.ci_tilt_measurements to authenticated;

insert into storage.buckets (id, name, public)
values ('ci-inspection-photos', 'ci-inspection-photos', false)
on conflict (id) do nothing;

drop policy if exists "ci_inspection_photos_select_members" on storage.objects;
create policy "ci_inspection_photos_select_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ci-inspection-photos'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ci_inspection_photos_insert_members" on storage.objects;
create policy "ci_inspection_photos_insert_members"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ci-inspection-photos'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ci_inspection_photos_update_members" on storage.objects;
create policy "ci_inspection_photos_update_members"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ci-inspection-photos'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'ci-inspection-photos'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ci_inspection_photos_delete_members" on storage.objects;
create policy "ci_inspection_photos_delete_members"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ci-inspection-photos'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);
