-- DAP Flow — individual load capacity (DAP Manager methodology)
--
-- Adds the per-job-order estimated hours that drive each member's Load Ratio:
--   Load Ratio = (Total Assigned Work Hours ÷ 38.475) × 100
--
-- Until this runs, the app falls back to the per-service defaults in
-- ACTIVITY_HOURS and simply does not persist per-JO overrides. Run it in the
-- Supabase SQL editor.

alter table job_orders
  add column if not exists estimated_hours numeric;

comment on column job_orders.estimated_hours is
  'Estimated work hours for this job order. Overrides the per-service default when set; drives the individual Load Ratio.';
