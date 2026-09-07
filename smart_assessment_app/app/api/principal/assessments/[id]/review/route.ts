import { NextResponse } from "next/server";

import { aggregateClassPerformance } from "@/lib/analytics";
import { requirePrincipalSession } from "@/lib/auth/principal";
import { generatePrincipalReview, type PrincipalReviewDiagnostics } from "@/lib/gemini/principal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let principalUserId = "unknown";
  let requestPayload: unknown = null;
  let reviewInput: { passed: number; failed: number; weakConcepts: string[] } | null = null;
  let geminiDiagnostics: PrincipalReviewDiagnostics | null = null;

  const debugResponse = () =>
    process.env.NODE_ENV === "production"
      ? {}
      : { _debug: { principalUserId, requestPayload, reviewInput, gemini: geminiDiagnostics } };

  try {
    const { id } = await params;
    requestPayload = await _request.json().catch(() => null);
    const { user, profile } = await requirePrincipalSession();
    principalUserId = user.id;
    console.info("[principal review] request", JSON.stringify({ principalUserId, assessmentId: id, requestPayload }));

    if (!profile.school_id) {
      return NextResponse.json({ error: { message: "Principal is not assigned to a school." }, ...debugResponse() }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, class_id, classes!inner(id, teacher_id)")
      .eq("id", id)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: { message: "Assessment not found." }, ...debugResponse() }, { status: 404 });
    }

    const teacherId = Array.isArray((assessment as any).classes)
      ? (assessment as any).classes[0]?.teacher_id
      : (assessment as any).classes?.teacher_id;

    if (!teacherId) {
      return NextResponse.json({ error: { message: "Assessment teacher not found." }, ...debugResponse() }, { status: 404 });
    }

    const { data: teacherProfile, error: teacherProfileError } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", teacherId)
      .single();

    if (teacherProfileError || !teacherProfile || teacherProfile.school_id !== profile.school_id) {
      return NextResponse.json({ error: { message: "Assessment is not in this principal's school." }, ...debugResponse() }, { status: 403 });
    }

    const { data: members } = await supabase.from("class_members").select("student_id").eq("class_id", assessment.class_id);
    const studentIds = (members ?? []).map((member) => member.student_id);

    let studentProfiles: any[] = [];
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", studentIds);
      studentProfiles = profiles ?? [];
    }

    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, student_id, score, total, started_at, submitted_at")
      .eq("assessment_id", assessment.id);

    const attemptIds = (attempts ?? []).filter((attempt) => attempt.submitted_at).map((attempt) => attempt.id);

    let conceptPerfs: any[] = [];
    if (attemptIds.length > 0) {
      const { data: conceptData } = await supabase
        .from("concept_perf")
        .select("attempt_id, concept, correct_count, total_count, accuracy")
        .in("attempt_id", attemptIds);
      conceptPerfs = conceptData ?? [];
    }

    const performanceResult = aggregateClassPerformance(
      members ?? [],
      studentProfiles,
      attempts ?? [],
      conceptPerfs,
    );

    reviewInput = {
      passed: performanceResult.overview.passed,
      failed: performanceResult.overview.failed,
      weakConcepts: performanceResult.weakConcepts.map((concept) => concept.concept),
    };
    console.info("[principal review] generated input", JSON.stringify({ principalUserId, assessmentId: id, reviewInput }));
    const review = await generatePrincipalReview(reviewInput, (diagnostics) => {
      geminiDiagnostics = diagnostics;
      console.info("[principal review] Gemini diagnostics", JSON.stringify(diagnostics));
    });

    if (!review) {
      return NextResponse.json({ error: { message: "AI review generation failed." }, ...debugResponse() }, { status: 500 });
    }

    return NextResponse.json({ review, ...debugResponse() });
  } catch (error: any) {
    console.error("[principal review] request failed", JSON.stringify({ principalUserId, error: error?.message ?? error }));
    return NextResponse.json({ error: { message: error.message || "Internal server error" }, ...debugResponse() }, { status: 500 });
  }
}
