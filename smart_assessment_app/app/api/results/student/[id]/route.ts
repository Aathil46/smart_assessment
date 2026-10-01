import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classifyConceptLevel, determinePassFail, isWeakStudent } from "@/lib/conceptEngine";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // 1. First attempt lookup by attempt id
    let { data: attempt } = await admin
      .from("attempts")
      .select("id,assessment_id,student_id,score,total,started_at,submitted_at")
      .eq("id", id)
      .eq("student_id", auth.user.id)
      .maybeSingle();

    // If not found by attempt id, check if id is an assessment_id for this student
    if (!attempt) {
      const { data: attemptByAssessment } = await admin
        .from("attempts")
        .select("id,assessment_id,student_id,score,total,started_at,submitted_at")
        .eq("assessment_id", id)
        .eq("student_id", auth.user.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attemptByAssessment) {
        attempt = attemptByAssessment;
      }
    }

    if (!attempt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Result not found." } },
        { status: 404 },
      );
    }

    // Handle in-progress attempts
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

    const [{ data: rawPerformance }, { data: gaps }, { data: assessmentData }] = await Promise.all([
      admin
        .from("concept_perf")
        .select("concept,correct_count,total_count,accuracy,level")
        .eq("attempt_id", attempt.id),
      admin
        .from("learning_gaps")
        .select("concept,gap_level,notes,recommendations")
        .eq("attempt_id", attempt.id),
      admin
        .from("assessments")
        .select("id,title,topic,class_id,classes(id,name,subject,teacher_id)")
        .eq("id", attempt.assessment_id)
        .single(),
    ]);

    let teacherName = "Teacher";
    let className = "Class";
    let subjectName = "General";
    if (assessmentData?.classes) {
      const cls = Array.isArray(assessmentData.classes) ? assessmentData.classes[0] : assessmentData.classes;
      if (cls) {
        className = cls.name || "Class";
        subjectName = cls.subject || "General";
        if (cls.teacher_id) {
          const { data: teacherProfile } = await admin
            .from("profiles")
            .select("name,email")
            .eq("id", cls.teacher_id)
            .single();
          if (teacherProfile) {
            teacherName = teacherProfile.name || teacherProfile.email?.split("@")[0] || "Teacher";
          }
        }
      }
    }

    const conceptPerformance = (rawPerformance ?? []).map((cp) => {
      const accuracy = Number(cp.accuracy);
      const level = (cp.level ?? classifyConceptLevel(accuracy)) as "Strong" | "Medium" | "Weak";
      return {
        concept: cp.concept,
        correctCount: cp.correct_count ?? 0,
        totalCount: cp.total_count ?? 0,
        accuracy,
        accuracyPercentage: Number((accuracy * 100).toFixed(1)),
        level,
      };
    });

    const strongConcepts = conceptPerformance.filter((c) => c.level === "Strong");
    const mediumConcepts = conceptPerformance.filter((c) => c.level === "Medium");
    const weakConcepts = conceptPerformance.filter((c) => c.level === "Weak");

    const passFail = determinePassFail(attempt.score ?? 0, attempt.total ?? 0);
    const weakStudent = isWeakStudent(conceptPerformance);

    const percentage =
      attempt.total && attempt.total > 0
        ? Math.round(((attempt.score ?? 0) / attempt.total) * 100)
        : 0;

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        assessment_id: attempt.assessment_id,
        score: attempt.score ?? 0,
        total: attempt.total ?? 0,
        percentage,
        passFail,
        isWeakStudent: weakStudent,
        submitted_at: attempt.submitted_at,
        started_at: attempt.started_at,
      },
      assessment: {
        id: assessmentData?.id || attempt.assessment_id,
        title: assessmentData?.title || "Assessment",
        topic: assessmentData?.topic || null,
        className,
        subject: subjectName,
        teacher: teacherName,
      },
      totalQuestions: attempt.total ?? 0,
      correctAnswers: attempt.score ?? 0,
      conceptPerformance,
      strongConcepts,
      mediumConcepts,
      weakConcepts,
      gaps: gaps ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal error" } },
      { status: 500 }
    );
  }
}