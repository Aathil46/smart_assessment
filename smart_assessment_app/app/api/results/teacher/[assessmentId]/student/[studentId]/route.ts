import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classifyConceptLevel, determinePassFail, isWeakStudent } from "@/lib/conceptEngine";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ assessmentId: string; studentId: string }> }
) {
  const { assessmentId, studentId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
      { status: 401 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.user.id).single();

  if (profile?.role !== "teacher") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Teacher access required." } },
      { status: 403 },
    );
  }

  // 1. Verify assessment belongs to a class owned by the teacher
  const { data: assessment } = await admin
    .from("assessments")
    .select("*, classes!inner(teacher_id, name)")
    .eq("id", assessmentId)
    .single();

  if (!assessment || (assessment.classes as any).teacher_id !== auth.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Assessment not found or unauthorized." } },
      { status: 403 },
    );
  }

  // 2. Verify student is a member of this class
  const { data: membership } = await admin
    .from("class_members")
    .select("student_id")
    .eq("class_id", assessment.class_id)
    .eq("student_id", studentId)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Student is not enrolled in this class." } },
      { status: 403 },
    );
  }

  // Fetch student profile
  const { data: studentProfile } = await admin
    .from("profiles")
    .select("id, name, email")
    .eq("id", studentId)
    .single();

  // 3. Fetch student attempt for this assessment
  const { data: attempt } = await admin
    .from("attempts")
    .select("id, assessment_id, student_id, score, total, started_at, submitted_at")
    .eq("assessment_id", assessmentId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({
      status: "not_started",
      student: studentProfile,
      assessment: {
        title: assessment.title,
        topic: assessment.topic,
      },
    });
  }

  if (!attempt.submitted_at) {
    return NextResponse.json({
      status: "in_progress",
      student: studentProfile,
      assessment: {
        title: assessment.title,
        topic: assessment.topic,
      },
      attempt: {
        id: attempt.id,
        started_at: attempt.started_at,
      },
    });
  }

  // 4. Consume existing Phase 4 concept_perf & learning_gaps
  const [{ data: rawPerformance }, { data: gaps }] = await Promise.all([
    admin
      .from("concept_perf")
      .select("concept,correct_count,total_count,accuracy,level")
      .eq("attempt_id", attempt.id),
    admin
      .from("learning_gaps")
      .select("concept,gap_level,notes,recommendations")
      .eq("attempt_id", attempt.id),
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
    status: "completed",
    student: studentProfile,
    assessment: {
      title: assessment.title,
      topic: assessment.topic,
    },
    attempt: {
      id: attempt.id,
      score: attempt.score,
      total: attempt.total,
      percentage:
        attempt.total && attempt.total > 0
          ? Number((((attempt.score ?? 0) / attempt.total) * 100).toFixed(2))
          : 0,
      passFail,
      isWeakStudent: weakStudent,
      submittedAt: attempt.submitted_at,
    },
    conceptPerformance,
    gaps: gaps ?? [],
  });
}
