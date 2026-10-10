-- Migration: Add AI insights cache column to assessments table
-- Stores Gemini-generated AI insights per assessment to avoid redundant API calls

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS ai_insights jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_insights_generated_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN assessments.ai_insights IS 'Cached AI-generated insights for this assessment (generated on demand by teacher)';
COMMENT ON COLUMN assessments.ai_insights_generated_at IS 'Timestamp when ai_insights was last generated';
