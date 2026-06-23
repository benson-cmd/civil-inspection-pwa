alter table public.ci_projects
  add column if not exists survey_dates jsonb not null default '[]'::jsonb,
  add column if not exists county_city text,
  add column if not exists site_status_note text,
  add column if not exists process_note text,
  add column if not exists target_list jsonb not null default '[]'::jsonb;

comment on column public.ci_projects.survey_dates is '多次會勘日期，供主文第六節自動生成。';
comment on column public.ci_projects.county_city is '縣市別，供主文第五節自治條例名稱自動帶入。';
comment on column public.ci_projects.site_status_note is '工地現況說明，供主文第九節自動生成。';
comment on column public.ci_projects.process_note is '鑑定過程補充說明，供主文第八節自動生成。';
comment on column public.ci_projects.target_list is '多標的物地址與用途清單，供主文第三節與第十節自動生成。';
