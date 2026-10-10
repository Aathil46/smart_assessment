-- Migration 0016: Add personal Gemini API key column to profiles table for teachers
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gemini_api_key text DEFAULT NULL;

COMMENT ON COLUMN profiles.gemini_api_key IS 'Teacher personal Gemini API key for AI generation; when set, used for that teacher''s AI requests instead of the platform fallback key';
