-- DAP Flow — Settings: role removal, department status
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- 1. resources.is_active — removing a role from a member marks its row
--    inactive instead of deleting it, so job orders and logged hours that
--    reference the role keep their history. Inactive roles are not offered
--    for new assignments and can be restored.
-- 2. booking_departments.is_active — deactivate a department to hide it from
--    the request form without deleting it.
-- 3. Seed the six default departments into the table so it is the single
--    source of truth. (Previously they lived only in code; adding one custom
--    department made them vanish from the public request form.)

alter table resources
  add column if not exists is_active boolean not null default true;

alter table booking_departments
  add column if not exists is_active boolean not null default true;

insert into booking_departments (id, name, is_default, is_active, created_at) values
  ('dept_bmg',   'BMG',   true, true, '1970-01-01T00:00:00Z'),
  ('dept_mod',   'MOD',   true, true, '1970-01-01T00:00:00Z'),
  ('dept_mto',   'MTO',   true, true, '1970-01-01T00:00:00Z'),
  ('dept_cbe',   'CBE',   true, true, '1970-01-01T00:00:00Z'),
  ('dept_sales', 'Sales', true, true, '1970-01-01T00:00:00Z'),
  ('dept_hr',    'HR',    true, true, '1970-01-01T00:00:00Z')
on conflict (id) do nothing;

-- 4. Row-level security on booking_departments blocked inserts from the app,
--    so "Add Department" never actually saved (the row appeared on screen and
--    vanished on reload). Allow the app to manage departments like it already
--    manages resources and approvers.
drop policy if exists "anon can insert booking_departments" on booking_departments;
drop policy if exists "anon can update booking_departments" on booking_departments;
drop policy if exists "anon can delete booking_departments" on booking_departments;
create policy "anon can insert booking_departments" on booking_departments for insert to anon with check (true);
create policy "anon can update booking_departments" on booking_departments for update to anon using (true) with check (true);
create policy "anon can delete booking_departments" on booking_departments for delete to anon using (true);
