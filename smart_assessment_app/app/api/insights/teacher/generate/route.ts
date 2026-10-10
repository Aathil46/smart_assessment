import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { aggregateClassPerformance } from "@/lib/analytics";
import { generateTeacherInsights } from "@/lib/gemini/teacher-insights";
import { getTeacherGeminiApiKey } from "@/lib/gemini/teacher-credentials";

/**
 * GET  /api/insights/teacher/generate?assessmentId=xxx
 *   Returns cached insights if available.
 *
 * POST /api/insights/teacher/generate
 *   Body: { assessmentId: string }
 *   Generates fresh AI insights for a specific completed assessment,
 *   caches the result in assessments.ai_insights, and returns it.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");
    if (!assessmentId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "assessmentId is required." } },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();

    // Verify teacher owns this assessment
    const { data: assessment } = await admin
      .from("assessments")
      .select("id, title, topic, class_id, ai_insights, ai_insights_generated_at, classes(teacher_id, name, subject)")
      .eq("id", assessmentId)
      .single();

    if (!assessment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Assessment not found." } },
        { status: 404 }
      );
    }

    const classData = assessment.classes as any;
    if (classData?.teacher_id !== auth.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied." } },
        { status: 403 }
      );
    }

    if (assessment.ai_insights) {
      return NextResponse.json({
        cached: true,
        insights: assessment.ai_insights,
        generatedAt: assessment.ai_insights_generated_at,
      });
    }

    return NextResponse.json({ cached: false, insights: null });
  } catch (error) {
    console.error("GET /api/insights/teacher/generate error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load insights." } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assessmentId } = body as { assessmentId: string };

    if (!assessmentId || typeof assessmentId !== "string") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "assessmentId is required." } },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();

    // Verify teacher owns this assessment and fetch class data
    const { data: assessment } = await admin
      .from("assessments")
      .select("id, title, topic, class_id, status, classes(teacher_id, name, subject)")
      .eq("id", assessmentId)
      .single();

    if (!assessment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Assessment not found." } },
        { status: 404 }
      );
    }

    const classData = assessment.classes as any;
    if (classData?.teacher_id !== auth.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied." } },
        { status: 403 }
      );
    }

    // Fetch class members
    const { data: members } = await admin
      .from("class_members")
      .select("student_id")
      .eq("class_id", assessment.class_id);

    const studentIds = (members ?? []).map((m) => m.student_id);

    // Fetch student profiles
    let studentProfiles: any[] = [];
    if (studentIds.length > 0) {
      const { data: profilesData } = await admin
        .from("profiles")
        .select("id, name")
        .in("id", studentIds);
      studentProfiles = profilesData ?? [];
    }

    // Fetch attempts for this assessment
    const { data: attempts } = await admin
      .from("attempts")
      .select("id, student_id, score, total, started_at, submitted_at")
      .eq("assessment_id", assessmentId);

    const attemptIds = (attempts ?? []).filter((a) => a.submitted_at).map((a) => a.id);

    if (attemptIds.length === 0) {
      return NextResponse.json(
        { error: { code: "NO_DATA", message: "No completed attempts found for this assessment." } },
        { status: 422 }
      );
    }

    // Fetch concept performance for completed attempts
    const { data: conceptPerfs } = await admin
      .from("concept_perf")
      .select("attempt_id, concept, correct_count, total_count, accuracy, level")
      .in("attempt_id", attemptIds);

    // Use the analytics engine to aggregate data
    const analyticsResult = aggregateClassPerformance(
      members ?? [],
      studentProfiles,
      attempts ?? [],
      conceptPerfs ?? []
    );

    const { weakConcepts, mediumConcepts } = analyticsResult;

    if (weakConcepts.length === 0 && mediumConcepts.length === 0) {
      // No meaningful learning gaps — return empty insights
      const emptyResult = { insights: [], generatedAt: new Date().toISOString() };

      // Cache the empty result too
      await admin
        .from("assessments")
        .update({
          ai_insights: emptyResult,
          ai_insights_generated_at: new Date().toISOString(),
        })
        .eq("id", assessmentId);

      return NextResponse.json({ cached: false, insights: emptyResult, generatedAt: emptyResult.generatedAt });
    }

    // Prepare the weakness data for Gemini
    const weaknessInput = weakConcepts.map((c) => ({
      concept: c.concept,
      accuracyPct: Math.round(c.accuracyPercentage),
      weakStudentCount: c.affectedStudents.length,
      totalStudentCount: analyticsResult.overview.completed,
      studentNames: c.affectedStudents.map((s) => s.name.split(" ")[0]), // first name only
    }));

    const mediumWeaknessInput = mediumConcepts.map((c) => ({
      concept: c.concept,
      accuracyPct: Math.round(c.accuracyPercentage),
      weakStudentCount: c.affectedStudents.length,
      totalStudentCount: analyticsResult.overview.completed,
      studentNames: c.affectedStudents.map((s) => s.name.split(" ")[0]),
    }));

    // Generate AI insights
    const teacherKey = await getTeacherGeminiApiKey(auth.user.id);
    const aiResult = await generateTeacherInsights({
      assessmentTitle: assessment.title,
      subject: classData?.subject ?? null,
      weaknesses: weaknessInput,
      mediumWeaknesses: mediumWeaknessInput,
      apiKey: teacherKey,
    });

    if (!aiResult) {
      // Fallback: build deterministic insights from analytics data when AI fails
      const deterministicInsights = [
        ...weakConcepts.map((c) => ({
          concept: c.concept,
          priority: "high" as const,
          weakStudentCount: c.affectedStudents.length,
          action: `Reteach ${c.concept} with examples and practice questions. Focus on foundational understanding.`,
          focusStudents: c.affectedStudents.slice(0, 3).map((s) => s.name.split(" ")[0]),
        })),
        ...mediumConcepts.map((c) => ({
          concept: c.concept,
          priority: "medium" as const,
          weakStudentCount: c.affectedStudents.length,
          action: `Briefly revise ${c.concept}. Assign targeted practice problems to solidify understanding.`,
          focusStudents: c.affectedStudents.slice(0, 3).map((s) => s.name.split(" ")[0]),
        })),
      ];

      const fallbackResult = { insights: deterministicInsights, generatedAt: new Date().toISOString() };

      await admin
        .from("assessments")
        .update({
          ai_insights: fallbackResult,
          ai_insights_generated_at: new Date().toISOString(),
        })
        .eq("id", assessmentId);

      return NextResponse.json({ cached: false, insights: fallbackResult, generatedAt: fallbackResult.generatedAt });
    }

    // Cache the AI result in the database
    await admin
      .from("assessments")
      .update({
        ai_insights: aiResult,
        ai_insights_generated_at: aiResult.generatedAt,
      })
      .eq("id", assessmentId);

    return NextResponse.json({
      cached: false,
      insights: aiResult,
      generatedAt: aiResult.generatedAt,
    });
  } catch (error) {
    console.error("POST /api/insights/teacher/generate error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate insights." } },
      { status: 500 }
    );
  }
}
