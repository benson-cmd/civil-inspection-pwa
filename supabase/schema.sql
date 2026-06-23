create extension if not exists "pgcrypto";

create schema if not exists app_private;

create type public.user_role as enum ('admin', 'user');
create type public.attachment_mode as enum ('upload', 'editor');
create type public.attachment_status as enum ('empty', 'uploaded', 'editing', 'ready');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
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
  survey_dates jsonb not null default '[]'::jsonb,
  county_city text,
  site_status_note text,
  process_note text,
  target_list jsonb not null default '[]'::jsonb,
  engineer_names text,
  association_engineers text,
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.report_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_order integer not null,
  title text not null,
  content text not null default '',
  source text not null default 'editable',
  fixed_title boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (project_id, section_order)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  attachment_no integer not null,
  title text not null,
  mode public.attachment_mode not null,
  status public.attachment_status not null default 'empty',
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, attachment_no)
);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  address text not null,
  usage_type text,
  wall_finish text,
  ceiling_finish text,
  floor_finish text,
  survey_status text not null default '',
  note text
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.targets(id) on delete cascade,
  floor_name text not null,
  plan_svg_or_json jsonb,
  no_entry_zones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
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
  inaccessible boolean not null default false,
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
  storage_path text,
  caption text,
  taken_at timestamptz not null default now()
);

create table public.site_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  photo_no text not null,
  image_url text not null,
  storage_path text,
  caption text,
  note text,
  taken_at timestamptz not null default now(),
  unique (project_id, photo_no)
);

create index projects_case_no_idx on public.projects(case_no);
create index project_members_user_id_idx on public.project_members(user_id);
create index report_sections_project_id_idx on public.report_sections(project_id);
create index attachments_project_id_idx on public.attachments(project_id);
create index targets_project_id_idx on public.targets(project_id);
create index floors_target_id_idx on public.floors(target_id);
create index inspection_points_floor_id_idx on public.inspection_points(floor_id);
create index photos_point_id_idx on public.photos(point_id);
create index site_photos_project_id_idx on public.site_photos(project_id);

create or replace function app_private.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function app_private.can_access_project(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select app_private.is_admin()
    or exists (
      select 1
      from public.project_members
      where project_id = project_uuid
        and user_id = auth.uid()
    );
$$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.report_sections enable row level security;
alter table public.attachments enable row level security;
alter table public.targets enable row level security;
alter table public.floors enable row level security;
alter table public.inspection_points enable row level security;
alter table public.photos enable row level security;
alter table public.site_photos enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or app_private.is_admin());

create policy "profiles_update_self_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or app_private.is_admin())
with check (id = auth.uid() or app_private.is_admin());

create policy "projects_select_members"
on public.projects for select
to authenticated
using (app_private.can_access_project(id));

create policy "projects_insert_authenticated"
on public.projects for insert
to authenticated
with check (owner_id = auth.uid() or app_private.is_admin());

create policy "projects_update_members"
on public.projects for update
to authenticated
using (app_private.can_access_project(id))
with check (app_private.can_access_project(id));

create policy "project_members_select_members"
on public.project_members for select
to authenticated
using (app_private.can_access_project(project_id));

create policy "project_members_manage_admin"
on public.project_members for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "report_sections_project_members"
on public.report_sections for all
to authenticated
using (app_private.can_access_project(project_id))
with check (app_private.can_access_project(project_id));

create policy "attachments_project_members"
on public.attachments for all
to authenticated
using (app_private.can_access_project(project_id))
with check (app_private.can_access_project(project_id));

create policy "targets_project_members"
on public.targets for all
to authenticated
using (app_private.can_access_project(project_id))
with check (app_private.can_access_project(project_id));

create policy "floors_project_members"
on public.floors for all
to authenticated
using (
  exists (
    select 1
    from public.targets
    where targets.id = floors.target_id
      and app_private.can_access_project(targets.project_id)
  )
)
with check (
  exists (
    select 1
    from public.targets
    where targets.id = floors.target_id
      and app_private.can_access_project(targets.project_id)
  )
);

create policy "inspection_points_project_members"
on public.inspection_points for all
to authenticated
using (
  exists (
    select 1
    from public.floors
    join public.targets on targets.id = floors.target_id
    where floors.id = inspection_points.floor_id
      and app_private.can_access_project(targets.project_id)
  )
)
with check (
  exists (
    select 1
    from public.floors
    join public.targets on targets.id = floors.target_id
    where floors.id = inspection_points.floor_id
      and app_private.can_access_project(targets.project_id)
  )
);

create policy "photos_project_members"
on public.photos for all
to authenticated
using (
  exists (
    select 1
    from public.inspection_points
    join public.floors on floors.id = inspection_points.floor_id
    join public.targets on targets.id = floors.target_id
    where inspection_points.id = photos.point_id
      and app_private.can_access_project(targets.project_id)
  )
)
with check (
  exists (
    select 1
    from public.inspection_points
    join public.floors on floors.id = inspection_points.floor_id
    join public.targets on targets.id = floors.target_id
    where inspection_points.id = photos.point_id
      and app_private.can_access_project(targets.project_id)
  )
);

create policy "site_photos_project_members"
on public.site_photos for all
to authenticated
using (app_private.can_access_project(project_id))
with check (app_private.can_access_project(project_id));

insert into storage.buckets (id, name, public)
values
  ('inspection-photos', 'inspection-photos', false),
  ('inspection-attachments', 'inspection-attachments', false)
on conflict (id) do nothing;
