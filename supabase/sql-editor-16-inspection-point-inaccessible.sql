alter table public.ci_inspection_points
  add column if not exists inaccessible boolean not null default false;
