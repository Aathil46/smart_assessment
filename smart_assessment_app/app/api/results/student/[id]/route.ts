import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classifyConceptLevel, determinePassFail, isWeakStudent } from "@/lib/conceptEngine";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
      { status: 401 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: attempt } = await admin
    .from("attempts")
    .select("id,assessment_id,student_id,score,total,started_at,submitted_at")
    .eq("id", id)
    .eq("student_id", auth.user.id)
    .single();

  if (!attempt) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Result not found." } },
      { status: 404 },
    );
  }

  // Handle in-progress attempts: Do not return final concept results
  if (!attempt.submitted_at) {
    return NextResponse.json(
      {
        status: "in_progress",
        attempt: {
          id: attempt.id,
          assessment_id: attempt.assessment_id,
          started_at: attempt.started_at,
          submitted_at: null,
        },
        message: "Assessment attempt is still in progress.",
      },
      { status: 200 },
    );
  }

  const [{ data: rawPerformance }, { data: gaps }, { data: assessment }] = await Promise.all([
    admin
      .from("concept_perf")
      .select("concept,correct_count,total_count,accuracy,level")
      .eq("attempt_id", id),
    admin
      .from("learning_gaps")
      .select("concept,gap_level,notes,recommendations")
      .eq("attempt_id", id),
    admin
      .from("assessments")
      .select("title,topic")
      .eq("id", attempt.assessment_id)
      .single(),
  ]);

  const conceptPerformance = (rawPerformance ?? []).map((cp) => {
    const accuracy = Number(cp.accuracy);
    const level = cp.level ?? classifyConceptLevel(accuracy);
    return {
      concept: cp.concept,
      correctCount: cp.correct_count,
      totalCount: cp.total_count,
      accuracy,
      accuracyPercentage: Number((accuracy * 100).toFixed(2)),
      level,
    };
  });

  const passFail = determinePassFail(attempt.score ?? 0, attempt.total ?? 0);
  const weakStudent = isWeakStudent(conceptPerformance);

  return NextResponse.json({
    attempt: {
      ...attempt,
      percentage:
        attempt.total && attempt.total > 0
          ? Number((((attempt.score ?? 0) / attempt.total) * 100).toFixed(2))
          : 0,
      passFail,
      isWeakStudent: weakStudent,
    },
    assessment,
    conceptPerformance,
    gaps: gaps ?? [],
  });
}