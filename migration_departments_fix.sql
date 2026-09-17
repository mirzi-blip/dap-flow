-- DAP Flow — booking_departments access reset (run once; safe to re-run)
--
-- The app reads and writes this table with the anon key, like it does for
-- approvers and resources. Whatever policies the table currently has, the app
-- sees 0 rows and cannot insert. This replaces them with one known-good set
-- (read / insert / update / delete for anon), grants the table privileges,
-- re-seeds the defaults, and prints the row count so the result is visible.

alter table booking_departments enable row level security;

-- Drop every existing policy on the table, whatever it is called
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'booking_departments' loop
    execute format('drop policy if exists %I on public.booking_departments', p.policyname);
  end loop;
end $$;

create policy "anon can read booking_departments"   on booking_departments for select to anon using (true);
create policy "anon can insert booking_departments" on booking_departments for insert to anon with check (true);
create policy "anon can update booking_departments" on booking_departments for update to anon using (true) with check (true);
create policy "anon can delete booking_departments" on booking_departments for delete to anon using (true);

grant select, insert, update, delete on booking_departments to anon;

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

-- You should see 6 (or more, if custom departments already exist)
select count(*) as departments from booking_departments;
