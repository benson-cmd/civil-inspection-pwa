-- 01. Create Civil Inspection PWA tables in an existing Supabase project.
-- Run this first.

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
  applicant_name text,
  applicant_address text,
  applicant_phone text,
  contact_person text,
  inspection_type text,
  inspection_date date,
  report_status text not null default '草稿',
  received_date date,
  received_no text,
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
