-- Migration 0015: Recommended Videos Cache
-- Caches YouTube educational video search results per weak concept, subject, and grade
-- to minimize YouTube Data API v3 quota usage.

CREATE TABLE IF NOT EXISTS recommended_videos_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  concept TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  search_query TEXT NOT NULL,
  videos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_videos_cache_key ON recommended_videos_cache (cache_key);

ALTER TABLE recommended_videos_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (students & teachers) to read cached video recommendations
CREATE POLICY "authenticated_read_recommended_videos_cache"
  ON recommended_videos_cache FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE recommended_videos_cache IS 'Server-side cache for educational YouTube video recommendations for student weak concepts';
