/**
 * Server-side YouTube Data API v3 integration for educational video recommendations.
 * 
 * IMPORTANT:
 * - This module runs strictly on the server (API routes / server actions).
 * - YOUTUBE_API_KEY is never sent to the client.
 * - All recommendations are derived from actual YouTube Data API v3 search results.
 */

export interface RecommendedVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string | null;
  videoUrl: string;
  publishedAt: string;
  relevanceLabel: string;
}

export interface SearchQueryContext {
  concept: string;
  subject?: string | null;
  topic?: string | null;
  grade?: string | null;
}

/**
 * Decode common HTML entities from YouTube titles and channel names.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return "";
      }
    });
}

/**
 * Convert ISO 8601 duration (e.g. PT16M14S, PT8M, PT1H5M20S) into human-readable string.
 */
export function formatIsoDuration(isoDuration: string | undefined | null): string | null {
  if (!isoDuration) return null;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${minutes} min`;
  }
  return seconds > 0 ? `${seconds}s` : null;
}

/**
 * Assign an educational relevance badge/label based on video title, duration, and keywords.
 */
export function deriveRelevanceLabel(title: string, durationStr: string | null): string {
  const lower = title.toLowerCase();

  if (lower.includes("class 10") || lower.includes("class 9") || lower.includes("class 11") || lower.includes("cbse") || lower.includes("ncert")) {
    return "Curriculum Aligned";
  }
  if (lower.includes("one shot") || lower.includes("revision") || lower.includes("summary") || lower.includes("in 5 min") || lower.includes("in 10 min")) {
    return "Quick Review";
  }
  if (lower.includes("deep dive") || lower.includes("in depth") || lower.includes("understanding") || lower.includes("explained")) {
    return "Concept Deep Dive";
  }
  if (lower.includes("experiment") || lower.includes("practical") || lower.includes("demonstration") || lower.includes("animation")) {
    return "Visual Guide";
  }
  if (lower.includes("lesson") || lower.includes("tutorial") || lower.includes("step by step")) {
    return "Step-by-Step Lesson";
  }

  // Duration heuristic
  if (durationStr && (durationStr.endsWith("s") || (durationStr.includes(":") && parseInt(durationStr.split(":")[0], 10) < 5))) {
    return "Quick Concept";
  }

  return "Core Concept";
}

/**
 * Normalize grade string to YouTube friendly search term (e.g. "5TH" -> "class 5").
 */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  const cleaned = grade.trim().toUpperCase().replace(/GRADE\s*/i, "").replace(/TH|ST|ND|RD/g, "").trim();
  if (/^\d+$/.test(cleaned)) {
    return `class ${cleaned}`;
  }
  return grade.trim().toLowerCase();
}

/**
 * Build a focused YouTube search query using subject, topic/concept, grade where available,
 * and educational intent.
 *
 * Example:
 * Concept: Glucose, Subject: Biology, Topic: Photosynthesis, Grade: 10
 * -> "photosynthesis glucose class 10"
 *
 * Concept: Latent Heat, Subject: Science, Topic: Matter, Grade: 5
 * -> "latent heat matter science class 5"
 */
export function buildYouTubeSearchQuery(ctx: SearchQueryContext): string {
  const parts: string[] = [];
  const concept = ctx.concept.trim();
  const lowerConcept = concept.toLowerCase();

  // 1. Topic if distinct from concept
  if (ctx.topic && ctx.topic.trim()) {
    const topic = ctx.topic.trim();
    if (!lowerConcept.includes(topic.toLowerCase()) && !topic.toLowerCase().includes(lowerConcept)) {
      parts.push(topic);
    }
  }

  // 2. Primary Weak Concept
  parts.push(concept);

  // 3. Subject if distinct from topic/concept
  if (ctx.subject && ctx.subject.trim()) {
    const subject = ctx.subject.trim();
    const lowerSub = subject.toLowerCase();
    if (!lowerConcept.includes(lowerSub) && !parts.some(p => p.toLowerCase().includes(lowerSub))) {
      parts.push(subject);
    }
  }

  // 4. Grade / Class if available
  const normGrade = normalizeGrade(ctx.grade);
  if (normGrade) {
    parts.push(normGrade);
  }

  // Join and sanitize
  const query = parts.join(" ").replace(/\s+/g, " ").trim();
  return query;
}

/**
 * Calls official YouTube Data API v3 to search public educational videos.
 * Retrieves top matching videos and enriches them with duration and metadata.
 */
export async function searchEducationalVideos(
  query: string,
  limit: number = 3
): Promise<RecommendedVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY environment variable is not configured.");
  }

  // 1. Search YouTube videos
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("safeSearch", "strict");
  searchUrl.searchParams.set("relevanceLanguage", "en");
  searchUrl.searchParams.set("maxResults", "5");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    console.error("[YouTube API] Search error:", searchRes.status, errorText);
    throw new Error(`YouTube API search failed with status ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const items = searchData.items || [];

  if (items.length === 0) {
    return [];
  }

  // Extract video IDs for duration lookup
  const videoIds = items
    .map((item: any) => item.id?.videoId)
    .filter((id: any): id is string => typeof id === "string" && id.length > 0);

  // 2. Fetch video duration via videos.list endpoint in a single batch
  const durationsMap = new Map<string, string | null>();
  if (videoIds.length > 0) {
    try {
      const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      videosUrl.searchParams.set("part", "contentDetails");
      videosUrl.searchParams.set("id", videoIds.join(","));
      videosUrl.searchParams.set("key", apiKey);

      const videosRes = await fetch(videosUrl.toString(), {
        headers: { Accept: "application/json" },
      });

      if (videosRes.ok) {
        const videosData = await videosRes.json();
        for (const v of videosData.items || []) {
          const rawDuration = v.contentDetails?.duration;
          durationsMap.set(v.id, formatIsoDuration(rawDuration));
        }
      }
    } catch (err) {
      console.warn("[YouTube API] Failed to fetch video durations, continuing without duration:", err);
    }
  }

  // 3. Assemble and rank recommended videos
  const videos: RecommendedVideo[] = [];

  for (const item of items) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;

    const rawTitle = item.snippet?.title || "";
    const rawChannel = item.snippet?.channelTitle || "";
    const title = decodeHtmlEntities(rawTitle);
    const channelTitle = decodeHtmlEntities(rawChannel);

    // Pick highest resolution available thumbnail
    const thumbnails = item.snippet?.thumbnails || {};
    const thumbnailUrl =
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const duration = durationsMap.get(videoId) || null;
    const relevanceLabel = deriveRelevanceLabel(title, duration);

    videos.push({
      id: videoId,
      title,
      channelTitle,
      thumbnailUrl,
      duration,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: item.snippet?.publishedAt || "",
      relevanceLabel,
    });

    if (videos.length >= limit) break;
  }

  return videos;
}
