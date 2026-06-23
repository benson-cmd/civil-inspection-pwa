alter table public.ci_projects
  add column if not exists final_date date;

comment on column public.ci_projects.final_date is '報告完稿日期，用於主文末尾與封面/匯出報告。';
