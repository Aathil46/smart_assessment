import { NextResponse } from "next/server";

import { aggregateClassPerformance } from "@/lib/analytics";
import { requirePrincipalSession } from "@/lib/auth/principal";
import { generatePrincipalReview } from "@/lib/gemini/principal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { profile } = await requirePrincipalSession();

    if (!profile.school_id) {
      return NextResponse.json({ error: { message: "Principal is not assigned to a school." } }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, class_id, classes!inner(id, teacher_id)")
      .eq("id", id)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: { message: "Assessment not found." } }, { status: 404 });
    }

    const teacherId = Array.isArray((assessment as any).classes)
      ? (assessment as any).classes[0]?.teacher_id
      : (assessment as any).classes?.teacher_id;

    if (!teacherId) {
      return NextResponse.json({ error: { message: "Assessment teacher not found." } }, { status: 404 });
    }

    const { data: teacherProfile, error: teacherProfileError } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", teacherId)
      .single();

    if (teacherProfileError || !teacherProfile || teacherProfile.school_id !== profile.school_id) {
      return NextResponse.json({ error: { message: "Assessment is not in this principal's school." } }, { status: 403 });
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
        .select("attempt_id, concept, correct_count, total_count, accuracy, level")
        .in("attempt_id", attemptIds);
      conceptPerfs = conceptData ?? [];
    }

    const performanceResult = aggregateClassPerformance(
      members ?? [],
      studentProfiles,
      attempts ?? [],
      conceptPerfs,
    );

    const review = await generatePrincipalReview({
      passed: performanceResult.overview.passed,
      failed: performanceResult.overview.failed,
      weakConcepts: performanceResult.weakConcepts.map((concept) => concept.concept),
    });

    if (!review) {
      return NextResponse.json({ error: { message: "AI review generation failed." } }, { status: 500 });
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
  }
}
