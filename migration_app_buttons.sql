-- DAP Flow — configurable app buttons (run once; safe to re-run)
--
-- Buttons that open an external tool inside the app, shown in the sidebar
-- below Settings and managed in Settings → Button Management. Adding another
-- one later is configuration, not a code change.
--
-- Policies are created before the seed so a seeding problem can never leave
-- the table unreadable, which is what happened with booking_departments.

create table if not exists app_buttons (
  id          text primary key,
  label       text not null,
  url         text not null,
  icon        text,
  roles       text[] not null default '{}',   -- empty = every signed-in role
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table app_buttons enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_buttons' loop
    execute format('drop policy if exists %I on public.app_buttons', p.policyname);
  end loop;
end $$;

create policy "anon can read app_buttons"   on app_buttons for select to anon using (true);
create policy "anon can insert app_buttons" on app_buttons for insert to anon with check (true);
create policy "anon can update app_buttons" on app_buttons for update to anon using (true) with check (true);
create policy "anon can delete app_buttons" on app_buttons for delete to anon using (true);

grant select, insert, update, delete on app_buttons to anon;

insert into app_buttons (id, label, url, icon, roles, is_active, sort_order)
select 'btn_dap_equipment', 'DAP Equipment', 'https://ipidap.info/eq/index.php', '🎥',
       array['Super Admin','Admin','DAP Team'], true, 0
where not exists (select 1 from app_buttons where id = 'btn_dap_equipment');

select id, label, url, roles, is_active from app_buttons order by sort_order;
