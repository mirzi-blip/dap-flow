-- DAP Flow — capacity + actual hours
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- 1. estimated_hours  — planned effort per job order; overrides the per-service
--                       default and drives the planned Load Ratio.
-- 2. work_segments    — actual hours. One entry per member per stretch of work,
--                       so a job order that goes back through Needs Revision
--                       records the rework instead of losing it. Timestamps are
--                       stamped by the app and are not user-editable.
--
--    [{ "id": "...", "memberId": "r123",
--       "startedAt": "2026-09-01T07:30:00Z", "endedAt": "2026-09-02T10:00:00Z",
--       "confirmedHours": 5, "overtimeHours": 1.5,
--       "confirmedBy": "Jade Borinaga", "confirmedAt": "..." }]

alter table job_orders
  add column if not exists estimated_hours numeric;

alter table job_orders
  add column if not exists work_segments jsonb not null default '[]'::jsonb;

comment on column job_orders.estimated_hours is
  'Planned work hours. Overrides the per-service default when set.';

comment on column job_orders.work_segments is
  'Actual work segments, one per member per stretch of work. Regular hours count only 07:30-17:30 Mon-Fri; overtime is explicit.';
