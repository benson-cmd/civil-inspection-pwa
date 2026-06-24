alter table public.ci_projects
  add column if not exists attachment_four_plan_paths jsonb not null default '[]'::jsonb,
  add column if not exists attachment_four_note text;

comment on column public.ci_projects.attachment_four_plan_paths is '附件四工地及鑑定標的物位置圖：手繪線條與底圖資料。';
comment on column public.ci_projects.attachment_four_note is '附件四工地及鑑定標的物位置圖：文字說明。';
