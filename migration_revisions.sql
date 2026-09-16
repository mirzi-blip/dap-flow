-- DAP Flow — revision tracking
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- revision_count: how many times a job order has been sent back for revision
-- (from For Approval, or by a reviewer). The app allows at most 3; once a job
-- order has used all 3 it can only be completed.

alter table job_orders
  add column if not exists revision_count integer not null default 0;

comment on column job_orders.revision_count is
  'Times sent to Needs Revision. Capped at 3 by the app; the 4th attempt is refused.';
