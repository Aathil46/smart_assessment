import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRecommendedVideosForAttempt } from "@/lib/services/recommendedVideos";

/**
 * GET /api/student/recommendations/videos?attemptId=xxx&refresh=true
 * 
 * Secure server-side route that:
 * 1. Authenticates student
 * 2. Retrieves the student's real weak concepts for the given attempt
 * 3. Returns cached or freshly queried educational YouTube videos
 * 
 * Never exposes YOUTUBE_API_KEY to the client.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get("attemptId") || searchParams.get("id");
    const refresh = searchParams.get("refresh") === "true";

    if (!attemptId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "attemptId parameter is required." } },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in to view recommended videos." } },
        { status: 401 }
      );
    }

    const recommendationsData = await getRecommendedVideosForAttempt(
      attemptId,
      auth.user.id,
      refresh
    );

    return NextResponse.json(recommendationsData);
  } catch (error) {
    console.error("GET /api/student/recommendations/videos error:", error);
    const message = error instanceof Error ? error.message : "Failed to load video recommendations.";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      { error: { code: "RECOMMENDATION_ERROR", message } },
      { status }
    );
  }
}

/**
 * POST /api/student/recommendations/videos
 * Body: { attemptId: string, refresh?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { attemptId, refresh } = body;

    if (!attemptId || typeof attemptId !== "string") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "attemptId is required in request body." } },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const recommendationsData = await getRecommendedVideosForAttempt(
      attemptId,
      auth.user.id,
      Boolean(refresh)
    );

    return NextResponse.json(recommendationsData);
  } catch (error) {
    console.error("POST /api/student/recommendations/videos error:", error);
    const message = error instanceof Error ? error.message : "Failed to load video recommendations.";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      { error: { code: "RECOMMENDATION_ERROR", message } },
      { status }
    );
  }
}
