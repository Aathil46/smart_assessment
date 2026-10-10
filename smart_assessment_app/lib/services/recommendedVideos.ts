import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  RecommendedVideo,
  buildYouTubeSearchQuery,
  searchEducationalVideos,
  SearchQueryContext,
} from "@/lib/youtube";

export interface ConceptRecommendationResult {
  concept: string;
  priority: "high" | "medium";
  accuracy: number;
  accuracyPercentage: number;
  statusMessage: string;
  searchQuery: string;
  videos: RecommendedVideo[];
  fromCache: boolean;
}

export interface AttemptRecommendationsResponse {
  attemptId: string;
  assessmentTitle: string;
  hasWeakConcepts: boolean;
  totalWeakConcepts: number;
  recommendations: ConceptRecommendationResult[];
  message?: string;
}

// In-memory cache for fast repeated lookups and minimal quota usage
interface MemoryCacheEntry {
  videos: RecommendedVideo[];
  timestamp: number;
  searchQuery: string;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Generates a normalized cache key for concept + subject + grade
 */
export function generateCacheKey(concept: string, subject?: string | null, grade?: string | null): string {
  const normConcept = concept.trim().toLowerCase();
  const normSubject = (subject || "general").trim().toLowerCase();
  const normGrade = (grade || "all").trim().toLowerCase().replace(/\s+/g, "");
  return `yt:${normConcept}:${normSubject}:${normGrade}`;
}

/**
 * Retrieves cached videos for a specific concept query context.
 * Checks:
 * 1. In-memory cache
 * 2. Supabase recommended_videos_cache table (if available)
 */
async function getCachedVideos(
  cacheKey: string,
  adminClient: ReturnType<typeof createAdminSupabaseClient>
): Promise<{ videos: RecommendedVideo[]; searchQuery?: string } | null> {
  const now = Date.now();

  // Tier 1: In-memory cache
  const memEntry = memoryCache.get(cacheKey);
  if (memEntry && now - memEntry.timestamp < CACHE_TTL_MS && memEntry.videos.length > 0) {
    return { videos: memEntry.videos, searchQuery: memEntry.searchQuery };
  }

  // Tier 2: Supabase recommended_videos_cache table
  try {
    const { data: dbEntry, error } = await adminClient
      .from("recommended_videos_cache")
      .select("videos, search_query, updated_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (!error && dbEntry && Array.isArray(dbEntry.videos) && dbEntry.videos.length > 0) {
      const updatedAt = dbEntry.updated_at ? new Date(dbEntry.updated_at).getTime() : 0;
      if (now - updatedAt < CACHE_TTL_MS) {
        // Populate Tier 1 cache
        memoryCache.set(cacheKey, {
          videos: dbEntry.videos as RecommendedVideo[],
          timestamp: updatedAt,
          searchQuery: dbEntry.search_query,
        });
        return {
          videos: dbEntry.videos as RecommendedVideo[],
          searchQuery: dbEntry.search_query,
        };
      }
    }
  } catch (err) {
    // If recommended_videos_cache table does not exist or has RLS error, proceed gracefully
    console.warn("[VideoCache] Supabase cache read warning (non-fatal):", err);
  }

  return null;
}

/**
 * Persists videos into Tier 1 and Tier 2 caches
 */
async function setCachedVideos(
  cacheKey: string,
  concept: string,
  subject: string | null | undefined,
  grade: string | null | undefined,
  searchQuery: string,
  videos: RecommendedVideo[],
  adminClient: ReturnType<typeof createAdminSupabaseClient>
): Promise<void> {
  const now = Date.now();

  // Tier 1: In-memory
  memoryCache.set(cacheKey, {
    videos,
    timestamp: now,
    searchQuery,
  });

  // Tier 2: Supabase table (best-effort)
  try {
    await adminClient.from("recommended_videos_cache").upsert(
      {
        cache_key: cacheKey,
        concept,
        subject: subject || null,
        grade: grade || null,
        search_query: searchQuery,
        videos,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "cache_key" }
    );
  } catch (err) {
    console.warn("[VideoCache] Supabase cache write warning (non-fatal):", err);
  }
}

/**
 * Main service function: fetches recommended YouTube videos for a student's attempt.
 *
 * Flow:
 * 1. Validates student owns the attempt.
 * 2. Fetches attempt metadata, assessment title, topic, class subject, grade.
 * 3. Identifies genuine Weak concepts (< 50% accuracy or level === 'Weak').
 * 4. Checks multi-tier cache for each weak concept.
 * 5. If not cached, performs targeted YouTube search via YouTube Data API v3.
 * 6. Stores returned videos in cache.
 * 7. Returns concept-grouped video recommendations for the UI.
 */
export async function getRecommendedVideosForAttempt(
  attemptId: string,
  studentId: string,
  forceRefresh: boolean = false
): Promise<AttemptRecommendationsResponse> {
  const admin = createAdminSupabaseClient();

  // 1. Fetch attempt and verify ownership
  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select("id, assessment_id, student_id, score, total, submitted_at")
    .eq("id", attemptId)
    .single();

  if (attemptError || !attempt) {
    throw new Error("Attempt not found.");
  }

  if (attempt.student_id !== studentId) {
    throw new Error("Forbidden: You do not have access to this assessment attempt.");
  }

  // 2. Fetch assessment details (class name, subject, grade, topic)
  const { data: assessment } = await admin
    .from("assessments")
    .select("id, title, topic, class_id, classes(name, subject, grade)")
    .eq("id", attempt.assessment_id)
    .single();

  const classData = Array.isArray(assessment?.classes)
    ? assessment?.classes[0]
    : (assessment?.classes as any);

  const subject = classData?.subject || "General";
  const grade = classData?.grade || null;
  const topic = assessment?.topic || null;
  const assessmentTitle = assessment?.title || "Assessment";

  // 3. Fetch student's concept performance for this attempt
  const { data: rawConceptPerfs } = await admin
    .from("concept_perf")
    .select("concept, correct_count, total_count, accuracy, level")
    .eq("attempt_id", attemptId);

  const conceptPerfs = rawConceptPerfs || [];

  // Filter ONLY weak concepts: accuracy < 0.5 or level === 'Weak'
  const weakConcepts = conceptPerfs.filter((cp) => {
    const accuracy = Number(cp.accuracy);
    return cp.level === "Weak" || accuracy < 0.5;
  });

  // If no weak concepts exist, return early with congratulatory status
  if (weakConcepts.length === 0) {
    return {
      attemptId,
      assessmentTitle,
      hasWeakConcepts: false,
      totalWeakConcepts: 0,
      recommendations: [],
      message: "You're doing well! No learning gaps were identified from this assessment.",
    };
  }

  // 4. For each weak concept, retrieve or search recommended videos
  const recommendations: ConceptRecommendationResult[] = [];

  for (const wc of weakConcepts) {
    const accuracy = Number(wc.accuracy);
    const accuracyPercentage = Math.round(accuracy * 100);
    const priority: "high" | "medium" = accuracy < 0.35 ? "high" : "medium";

    const queryContext: SearchQueryContext = {
      concept: wc.concept,
      subject,
      topic,
      grade,
    };

    const searchQuery = buildYouTubeSearchQuery(queryContext);
    const cacheKey = generateCacheKey(wc.concept, subject, grade);

    let videos: RecommendedVideo[] = [];
    let fromCache = false;

    // Check cache unless forceRefresh is true
    if (!forceRefresh) {
      const cached = await getCachedVideos(cacheKey, admin);
      if (cached && cached.videos.length > 0) {
        videos = cached.videos;
        fromCache = true;
      }
    }

    // If not cached, call YouTube API
    if (videos.length === 0) {
      try {
        videos = await searchEducationalVideos(searchQuery, 3);

        // Cache the newly retrieved videos
        if (videos.length > 0) {
          await setCachedVideos(cacheKey, wc.concept, subject, grade, searchQuery, videos, admin);

          // Also persist into learning_gaps table if attempt has learning_gaps row
          try {
            await admin.from("learning_gaps").upsert(
              {
                attempt_id: attemptId,
                concept: wc.concept,
                gap_level: "high",
                recommendations: { videos },
              },
              { onConflict: "attempt_id,concept" }
            );
          } catch (gapErr) {
            console.warn("[VideoCache] learning_gaps upsert warning:", gapErr);
          }
        }
      } catch (searchErr) {
        console.error(`[VideoService] YouTube search failed for "${searchQuery}":`, searchErr);
        // Fallback: check if we have any stale cache or learning_gaps data
        try {
          const { data: gapRow } = await admin
            .from("learning_gaps")
            .select("recommendations")
            .eq("attempt_id", attemptId)
            .eq("concept", wc.concept)
            .maybeSingle();

          const existingVideos = (gapRow?.recommendations as any)?.videos;
          if (Array.isArray(existingVideos) && existingVideos.length > 0) {
            videos = existingVideos;
            fromCache = true;
          }
        } catch {
          // Ignore fallback error
        }
      }
    }

    recommendations.push({
      concept: wc.concept,
      priority,
      accuracy,
      accuracyPercentage,
      statusMessage: "You may need more practice with this concept.",
      searchQuery,
      videos,
      fromCache,
    });
  }

  return {
    attemptId,
    assessmentTitle,
    hasWeakConcepts: true,
    totalWeakConcepts: weakConcepts.length,
    recommendations,
  };
}
