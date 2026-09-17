-- DAP Flow — Settings: role removal, department status
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- 1. resources.is_active — removing a role from a member marks its row
--    inactive instead of deleting it, so job orders and logged hours that
--    reference the role keep their history. Inactive roles are not offered
--    for new assignments and can be restored.
-- 2. booking_departments.is_active — deactivate a department to hide it from
--    the request form without deleting it.
-- 3. Row-level security on booking_departments blocked inserts from the app,
--    so "Add Department" never actually saved (the row appeared on screen and
--    vanished on reload). Allow the app to manage departments like it already
--    manages resources and approvers.
drop policy if exists "anon can insert booking_departments" on booking_departments;
drop policy if exists "anon can update booking_departments" on booking_departments;
drop policy if exists "anon can delete booking_departments" on booking_departments;
create policy "anon can insert booking_departments" on booking_departments for insert to anon with check (true);
create policy "anon can update booking_departments" on booking_departments for update to anon using (true) with check (true);
create policy "anon can delete booking_departments" on booking_departments for delete to anon using (true);

-- 4. Seed the six default departments into the table so it is the single
--    source of truth. (Previously they lived only in code; adding one custom
--    department made them vanish from the public request form.)

alter table resources
  add column if not exists is_active boolean not null default true;

alter table booking_departments
  add column if not exists is_active boolean not null default true;

insert into booking_departments (id, name, is_default, is_active, created_at)
select v.id, v.name, true, true, '1970-01-01T00:00:00Z'::timestamptz
from (values
  ('dept_bmg',   'BMG'),
  ('dept_mod',   'MOD'),
  ('dept_mto',   'MTO'),
  ('dept_cbe',   'CBE'),
  ('dept_sales', 'Sales'),
  ('dept_hr',    'HR')
) as v(id, name)
where not exists (
  select 1 from booking_departments d where d.id = v.id or lower(d.name) = lower(v.name)
);

