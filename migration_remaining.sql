-- DAP Flow — remaining migration steps (run once; safe to re-run)
--
-- migration_settings.sql applied its two ALTER statements, but the default-
-- department seed used ON CONFLICT (id), which needs a unique constraint the
-- table does not have. That statement failed and the policies after it never
-- ran. This script finishes the job, ordered so nothing can block the rest,
-- and also applies migration_revisions.sql, which had not been run.

-- 1. Revision tracking (from migration_revisions.sql)
alter table job_orders
  add column if not exists revision_count integer not null default 0;

-- 2. Let the app manage departments (it could read them but not write them)
drop policy if exists "anon can insert booking_departments" on booking_departments;
drop policy if exists "anon can update booking_departments" on booking_departments;
drop policy if exists "anon can delete booking_departments" on booking_departments;
create policy "anon can insert booking_departments" on booking_departments for insert to anon with check (true);
create policy "anon can update booking_departments" on booking_departments for update to anon using (true) with check (true);
create policy "anon can delete booking_departments" on booking_departments for delete to anon using (true);

-- 3. Seed the six default departments without relying on a unique constraint
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
