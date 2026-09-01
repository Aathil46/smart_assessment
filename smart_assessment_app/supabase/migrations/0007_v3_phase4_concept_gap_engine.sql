-- Migration 0007: V3 Phase 4 Concept Performance & Learning-Gap Engine
-- Adds level column to concept_perf and extends learning_gaps check constraint for 'Weak' level.

alter table concept_perf add column if not exists level text check (level in ('Strong', 'Medium', 'Weak'));
alter table concept_perf alter column accuracy type numeric;

-- Update learning_gaps constraint to accept V3 'Weak' level alongside legacy levels
alter table learning_gaps drop constraint if exists learning_gaps_gap_level_check;
alter table learning_gaps add constraint learning_gaps_gap_level_check check (gap_level in ('Weak', 'high', 'medium', 'low'));

-- Ensure indexes exist for fast lookup by attempt_id
create index if not exists idx_concept_perf_attempt on concept_perf (attempt_id);
create index if not exists idx_learning_gaps_attempt on learning_gaps (attempt_id);
