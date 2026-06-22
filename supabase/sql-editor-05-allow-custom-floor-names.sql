-- 05. Allow custom floor names in attachment seven.
-- Run this once in Supabase SQL Editor for existing databases.

alter table if exists public.ci_floors
  drop constraint if exists ci_floors_floor_name_check;

alter table if exists public.floors
  drop constraint if exists floors_floor_name_check;
