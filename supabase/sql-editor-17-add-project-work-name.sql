alter table public.ci_projects
  add column if not exists work_name text;

update public.ci_projects
set work_name = project_name
where work_name is null or btrim(work_name) = '';

comment on column public.ci_projects.work_name is '工程名稱，用於封面、主文鑑定要旨與報告自動組稿。';
