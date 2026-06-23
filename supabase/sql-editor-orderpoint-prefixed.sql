-- Civil Inspection PWA setup for the existing orderpoint-dimension project.
-- Use this prefixed version when public.projects or other generic names already exist.
-- Paste the whole file into Supabase SQL Editor and run it.

create extension if not exists "pgcrypto";

create schema if not exists app_private;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ci_user_role') then
    create type public.ci_user_role as enum ('admin', 'user');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ci_attachment_mode') then
    create type public.ci_attachment_mode as enum ('upload', 'editor');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ci_attachment_status') then
    create type public.ci_attachment_status as enum ('empty', 'uploaded', 'editing', 'ready');
  end if;
end $$;

create table if not exists public.ci_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role public.ci_user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ci_projects (
  id uuid primary key default gen_random_uuid(),
  case_no text not null,
  project_name text not null,
  work_name text,
  applicant_name text,
  applicant_address text,
  applicant_phone text,
  contact_person text,
  inspection_type text,
  inspection_date date,
  report_status text not null default '草稿',
  received_date date,
  received_no text,
  final_date date,
  target_summary text,
  engineer_names text,
  association_engineers text,
  owner_id uuid not null references public.ci_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ci_project_members (
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  user_id uuid not null references public.ci_profiles(id) on delete cascade,
  role public.ci_user_role not null default 'user',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.ci_report_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  section_order integer not null,
  title text not null,
  content text not null default '',
  source text not null default 'editable',
  fixed_title boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (project_id, section_order)
);

create table if not exists public.ci_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  attachment_no integer not null,
  title text not null,
  mode public.ci_attachment_mode not null,
  status public.ci_attachment_status not null default 'empty',
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, attachment_no)
);

create table if not exists public.ci_targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  address text not null,
  usage_type text,
  wall_finish text,
  ceiling_finish text,
  floor_finish text,
  survey_status text not null default '',
  note text
);

create table if not exists public.ci_floors (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.ci_targets(id) on delete cascade,
  floor_name text not null,
  plan_svg_or_json jsonb,
  no_entry_zones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ci_inspection_points (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.ci_floors(id) on delete cascade,
  photo_no text not null,
  x numeric(10, 3) not null,
  y numeric(10, 3) not null,
  direction_angle numeric(6, 2) not null default 0,
  component_type text[] not null default '{}',
  condition_type text[] not null default '{}',
  crack_width_mm numeric(6, 2),
  inaccessible boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint ci_inspection_points_direction_check check (direction_angle >= 0 and direction_angle < 360),
  constraint ci_inspection_points_crack_width_check check (crack_width_mm is null or crack_width_mm >= 0),
  constraint ci_inspection_points_component_type_check check (
    component_type <@ array['全景', '牆面', '平頂', '地坪', '梁', '柱', '其他']::text[]
  ),
  constraint ci_inspection_points_condition_type_check check (
    condition_type <@ array['現況', '裂縫', '滲水', '剝落', '其他']::text[]
  ),
  unique (floor_id, photo_no)
);

create table if not exists public.ci_photos (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.ci_inspection_points(id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  taken_at timestamptz not null default now()
);

create table if not exists public.ci_site_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_projects(id) on delete cascade,
  photo_no text not null,
  image_url text not null,
  storage_path text,
  caption text,
  note text,
  taken_at timestamptz not null default now(),
  unique (project_id, photo_no)
);

create index if not exists ci_projects_case_no_idx on public.ci_projects(case_no);
create index if not exists ci_project_members_user_id_idx on public.ci_project_members(user_id);
create index if not exists ci_report_sections_project_id_idx on public.ci_report_sections(project_id);
create index if not exists ci_attachments_project_id_idx on public.ci_attachments(project_id);
create index if not exists ci_targets_project_id_idx on public.ci_targets(project_id);
create index if not exists ci_floors_target_id_idx on public.ci_floors(target_id);
create index if not exists ci_inspection_points_floor_id_idx on public.ci_inspection_points(floor_id);
create index if not exists ci_photos_point_id_idx on public.ci_photos(point_id);
create index if not exists ci_site_photos_project_id_idx on public.ci_site_photos(project_id);

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

insert into storage.buckets (id, name, public)
values
  ('ci-inspection-photos', 'ci-inspection-photos', false),
  ('ci-inspection-attachments', 'ci-inspection-attachments', false)
on conflict (id) do nothing;

-- After your first Google login, run this with your actual Google email:
--
-- update public.ci_profiles
-- set role = 'admin'
-- where email = 'your-google-email@example.com';
