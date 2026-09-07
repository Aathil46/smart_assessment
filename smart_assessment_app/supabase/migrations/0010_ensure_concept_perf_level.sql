-- Ensure the concept performance contract used by submission and analytics exists
-- in environments where migration 0007 was recorded without applying the column.
alter table concept_perf
  add column if not exists level text check (level in ('Strong', 'Medium', 'Weak'));