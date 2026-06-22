-- 09. Extend attachment five/six for measurement diagrams and photos.
-- Run this once in Supabase SQL Editor after sql-editor-08.

alter table public.ci_projects
  add column if not exists level_plan_paths jsonb not null default '[]'::jsonb,
  add column if not exists tilt_plan_paths jsonb not null default '[]'::jsonb;

alter table public.ci_level_measurements
  add column if not exists measurement_date date,
  add column if not exists relative_elevation numeric(12, 3),
  add column if not exists x numeric(12, 3),
  add column if not exists y numeric(12, 3),
  add column if not exists image_url text,
  add column if not exists storage_path text,
  add column if not exists caption text,
  add column if not exists taken_at timestamptz;

alter table public.ci_tilt_measurements
  add column if not exists measurement_date date,
  add column if not exists x numeric(12, 3),
  add column if not exists y numeric(12, 3),
  add column if not exists upper_image_url text,
  add column if not exists upper_storage_path text,
  add column if not exists upper_caption text,
  add column if not exists upper_taken_at timestamptz,
  add column if not exists lower_image_url text,
  add column if not exists lower_storage_path text,
  add column if not exists lower_caption text,
  add column if not exists lower_taken_at timestamptz,
  add column if not exists note text;
