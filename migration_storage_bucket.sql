-- DAP Flow — file storage (run once; safe to re-run)
--
-- Every upload in the app targets the "booking-files" bucket, but the bucket
-- does not exist, so uploads have always failed silently: booking-request
-- attachments, the output file sent for review, and files attached to a job
-- order comment. There are zero uploaded files in the database — every
-- attachment on record is an external link someone pasted.
--
-- This creates the bucket and lets the app write to it and everyone read.

insert into storage.buckets (id, name, public)
values ('booking-files', 'booking-files', true)
on conflict (id) do update set public = true;

drop policy if exists "anon can upload booking-files"  on storage.objects;
drop policy if exists "anon can update booking-files"  on storage.objects;
drop policy if exists "public can read booking-files"  on storage.objects;

create policy "anon can upload booking-files" on storage.objects
  for insert to anon with check (bucket_id = 'booking-files');

create policy "anon can update booking-files" on storage.objects
  for update to anon using (bucket_id = 'booking-files') with check (bucket_id = 'booking-files');

create policy "public can read booking-files" on storage.objects
  for select using (bucket_id = 'booking-files');

select id, name, public from storage.buckets where id = 'booking-files';
