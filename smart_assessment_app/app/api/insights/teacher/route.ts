import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isWeakStudent } from "@/lib/conceptEngine";

/**
 * GET /api/insights/teacher
 * Returns completed assessments (with at least 1 submitted attempt) for the teacher,
 * along with metadata needed for the AI Insights page.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
      { status: 401 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "teacher") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Teacher access required." } },
      { status: 403 }
    );
  }

  // 1. Fetch teacher's classes
  const { data: teacherClasses } = await admin
    .from("classes")
    .select("id, name, subject")
    .eq("teacher_id", auth.user.id);

  const classesList = teacherClasses ?? [];
  if (classesList.length === 0) {
    return NextResponse.json({ assessments: [] });
  }

  const classIds = classesList.map((c) => c.id);
  const classMap = new Map<string, { name: string; subject: string | null }>(
    classesList.map((c) => [
      c.id,
      { name: c.name ? c.name.replace(/^"|"$/g, "") : "Class", subject: c.subject ?? null },
    ])
  );

  // 2. Fetch published assessments for these classes
  const { data: assessments } = await admin
    .from("assessments")
    .select("id, class_id, title, topic, status, created_at, ai_insights, ai_insights_generated_at")
    .in("class_id", classIds)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const assessmentList = assessments ?? [];
  if (assessmentList.length === 0) {
    return NextResponse.json({ assessments: [] });
  }

  const assessmentIds = assessmentList.map((a) => a.id);

  // 3. Fetch class member counts
  const { data: classMembers } = await admin
    .from("class_members")
    .select("class_id, student_id")
    .in("class_id", classIds);

  const classMemberCounts = new Map<string, number>();
  for (const m of classMembers ?? []) {
    classMemberCounts.set(m.class_id, (classMemberCounts.get(m.class_id) ?? 0) + 1);
  }

  // 4. Fetch submitted attempts per assessment
  const { data: attempts } = await admin
    .from("attempts")
    .select("assessment_id, id, student_id, submitted_at")
    .in("assessment_id", assessmentIds)
    .not("submitted_at", "is", null);

  const submittedAttempts = attempts ?? [];
  const submittedCountByAssessment = new Map<string, number>();
  for (const att of submittedAttempts) {
    submittedCountByAssessment.set(att.assessment_id, (submittedCountByAssessment.get(att.assessment_id) ?? 0) + 1);
  }

  // Filter completed assessments (with at least 1 submission)
  const completedAssessmentsList = assessmentList.filter(
    (a) => (submittedCountByAssessment.get(a.id) ?? 0) > 0
  );

  const completedAssessmentIds = new Set(completedAssessmentsList.map((a) => a.id));
  const relevantAttempts = submittedAttempts.filter((att) => completedAssessmentIds.has(att.assessment_id));
  const relevantAttemptIds = relevantAttempts.map((att) => att.id);

  // 5. Calculate concept and student metrics from real completed attempts
  let conceptsNeedingAttentionCount = 0;
  let studentsNeedingSupportCount = 0;

  if (relevantAttemptIds.length > 0) {
    const { data: cpData } = await admin
      .from("concept_perf")
      .select("attempt_id, concept, level, accuracy")
      .in("attempt_id", relevantAttemptIds);

    const conceptPerfs = cpData ?? [];

    // Distinct concepts needing attention (Weak or Medium / accuracy < 80%)
    const attentionConcepts = new Set<string>();
    for (const cp of conceptPerfs) {
      if (cp.level === "Weak" || cp.level === "Medium" || (typeof cp.accuracy === "number" && cp.accuracy < 0.8)) {
        if (cp.concept && cp.concept.trim()) {
          attentionConcepts.add(cp.concept.trim().toLowerCase());
        }
      }
    }
    conceptsNeedingAttentionCount = attentionConcepts.size;

    // Students needing support (isWeakStudent across their attempts)
    const studentAttemptsMap = new Map<string, string[]>();
    for (const att of relevantAttempts) {
      const list = studentAttemptsMap.get(att.student_id) ?? [];
      list.push(att.id);
      studentAttemptsMap.set(att.student_id, list);
    }

    const perfsByAttemptId = new Map<string, typeof conceptPerfs>();
    for (const cp of conceptPerfs) {
      const list = perfsByAttemptId.get(cp.attempt_id) ?? [];
      list.push(cp);
      perfsByAttemptId.set(cp.attempt_id, list);
    }

    const needingSupportStudentIds = new Set<string>();
    for (const [, attIds] of studentAttemptsMap.entries()) {
      for (const attId of attIds) {
        const perfs = perfsByAttemptId.get(attId) ?? [];
        if (perfs.length > 0 && isWeakStudent(perfs)) {
          needingSupportStudentIds.add(attId);
          break;
        }
      }
    }
    studentsNeedingSupportCount = needingSupportStudentIds.size;
  }

  // 6. Build response
  const result = completedAssessmentsList.map((a) => {
    const classInfo = classMap.get(a.class_id);
    const insightList = a.ai_insights && Array.isArray((a.ai_insights as any).insights)
      ? (a.ai_insights as any).insights
      : null;

    return {
      id: a.id,
      title: a.title,
      topic: a.topic,
      className: classInfo?.name ?? "Class",
      subject: classInfo?.subject ?? null,
      studentsTotal: classMemberCounts.get(a.class_id) ?? 0,
      studentsCompleted: submittedCountByAssessment.get(a.id) ?? 0,
      hasInsights: a.ai_insights !== null,
      insightsCount: insightList ? insightList.length : 0,
      insightsGeneratedAt: a.ai_insights_generated_at ?? null,
      createdAt: a.created_at,
    };
  });

  const generatedInsightsCount = result.filter((a) => a.hasInsights).length;

  return NextResponse.json({
    summary: {
      completedAssessments: result.length,
      generatedInsights: generatedInsightsCount,
      conceptsNeedingAttention: conceptsNeedingAttentionCount,
      studentsNeedingSupport: studentsNeedingSupportCount,
    },
    assessments: result,
  });
}
