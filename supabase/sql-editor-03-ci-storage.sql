-- 03. Create Civil Inspection PWA Storage buckets.
-- Run this after 01 and 02 succeed.

insert into storage.buckets (id, name, public)
values
  ('ci-inspection-photos', 'ci-inspection-photos', false),
  ('ci-inspection-attachments', 'ci-inspection-attachments', false)
on conflict (id) do nothing;
