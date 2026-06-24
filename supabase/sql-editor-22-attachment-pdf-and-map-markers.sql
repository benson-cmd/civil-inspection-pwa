-- 22. Attachment PDF storage paths and attachment-four map markers.

alter table public.ci_attachments
  add column if not exists storage_path text;

comment on column public.ci_attachments.storage_path is 'Supabase Storage path for uploaded attachment PDFs.';

alter table public.ci_projects
  add column if not exists attachment_four_markers jsonb not null default '[]'::jsonb;

comment on column public.ci_projects.attachment_four_markers is '附件四工地及鑑定標的物位置圖標示點。';

insert into storage.buckets (id, name, public)
values ('ci-inspection-attachments', 'ci-inspection-attachments', false)
on conflict (id) do nothing;

drop policy if exists "ci_inspection_attachments_select_members" on storage.objects;
create policy "ci_inspection_attachments_select_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ci-inspection-attachments'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ci_inspection_attachments_insert_members" on storage.objects;
create policy "ci_inspection_attachments_insert_members"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ci-inspection-attachments'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ci_inspection_attachments_update_members" on storage.objects;
create policy "ci_inspection_attachments_update_members"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ci-inspection-attachments'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'ci-inspection-attachments'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ci_inspection_attachments_delete_members" on storage.objects;
create policy "ci_inspection_attachments_delete_members"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ci-inspection-attachments'
  and app_private.ci_can_access_project((storage.foldername(name))[1]::uuid)
);
