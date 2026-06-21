-- 04. Add report status to existing Civil Inspection PWA projects.
-- Safe to run after the initial ci_* tables already exist.

alter table public.ci_projects
  add column if not exists report_status text not null default '草稿';

