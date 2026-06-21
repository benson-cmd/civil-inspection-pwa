create extension if not exists "pgcrypto";

create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'inspector',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  case_no text not null,
  project_name text not null,
  applicant_name text,
  inspection_type text,
  inspection_date date,
  created_at timestamptz not null default now()
);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  address text not null,
  usage_type text,
  wall_finish text,
  ceiling_finish text,
  floor_finish text,
  survey_status text not null default '未調查',
  note text
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.targets(id) on delete cascade,
  floor_name text not null,
  plan_svg_or_json jsonb,
  created_at timestamptz not null default now(),
  constraint floors_floor_name_check check (floor_name in ('1F', '2F', '3F', 'RF'))
);

create table public.inspection_points (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  photo_no text not null,
  x numeric(10, 3) not null,
  y numeric(10, 3) not null,
  direction_angle numeric(6, 2) not null default 0,
  component_type text[] not null default '{}',
  condition_type text[] not null default '{}',
  crack_width_mm numeric(6, 2),
  note text,
  created_at timestamptz not null default now(),
  constraint inspection_points_direction_check check (direction_angle >= 0 and direction_angle < 360),
  constraint inspection_points_crack_width_check check (crack_width_mm is null or crack_width_mm >= 0),
  constraint inspection_points_component_type_check check (
    component_type <@ array['全景', '牆面', '平頂', '地坪', '梁', '柱', '其他']::text[]
  ),
  constraint inspection_points_condition_type_check check (
    condition_type <@ array['現況', '裂縫', '滲水', '剝落', '其他']::text[]
  ),
  unique (floor_id, photo_no)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.inspection_points(id) on delete cascade,
  image_url text not null,
  caption text,
  taken_at timestamptz not null default now()
);

create index projects_case_no_idx on public.projects(case_no);
create index targets_project_id_idx on public.targets(project_id);
create index floors_target_id_idx on public.floors(target_id);
create index inspection_points_floor_id_idx on public.inspection_points(floor_id);
create index photos_point_id_idx on public.photos(point_id);

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;
