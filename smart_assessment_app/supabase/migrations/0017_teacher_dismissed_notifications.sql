-- Migration 0017: Add dismissed notifications tracking for teachers
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dismissed_notifications text[] DEFAULT '{}';

COMMENT ON COLUMN profiles.dismissed_notifications IS 'Array of notification IDs dismissed by this user';
