import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export async function GET(request: Request) {
  try {
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

    if (profile?.role !== "student") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Student access required." } },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const selectedClassId = url.searchParams.get("classId");

    // 1. Fetch student's enrolled classes
    const { data: memberships, error: memberError } = await admin
      .from("class_members")
      .select("class_id, joined_at")
      .eq("student_id", auth.user.id)
      .order("joined_at", { ascending: false });

    if (memberError) {
      throw new Error(memberError.message);
    }

    const enrolledClassIds = (memberships ?? []).map((m) => m.class_id);

    if (enrolledClassIds.length === 0) {
      return NextResponse.json({ classes: [], assessments: [] });
    }

    // 2. Fetch class records
    const { data: classesData, error: classesError } = await admin
      .from("classes")
      .select("id, name, subject, grade, code, teacher_id, created_at")
      .in("id", enrolledClassIds);

    if (classesError) {
      throw new Error(classesError.message);
    }

    // Teacher names
    const teacherIds = [...new Set((classesData ?? []).map((c) => c.teacher_id).filter(Boolean))];
    const { data: teachers } = teacherIds.length > 0
      ? await admin.from("profiles").select("id, name, email").in("id", teacherIds)
      : { data: [] };
    const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.name || t.email?.split("@")[0] || "Teacher"]));
    const classMap = new Map((classesData ?? []).map((c) => [c.id, c]));

    // 3. If a specific class is requested
    if (selectedClassId) {
      if (!enrolledClassIds.includes(selectedClassId)) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You are not enrolled in this class." } },
          { status: 403 }
        );
      }

      const cls = classMap.get(selectedClassId);
      if (!cls) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Class not found." } },
          { status: 404 }
        );
      }

      // Fetch published assessments for this class
      const { data: classAssessments } = await admin
        .from("assessments")
        .select("id, title, topic, difficulty, status, opens_at, closes_at, created_at")
        .eq("class_id", selectedClassId)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      const assessmentsList = classAssessments ?? [];
      const assessmentIds = assessmentsList.map((a) => a.id);

      // Question counts
      const { data: questionRows } = assessmentIds.length > 0
        ? await admin.from("questions").select("id, assessment_id").in("assessment_id", assessmentIds)
        : { data: [] };
      const questionCounts = new Map<string, number>();
      for (const q of questionRows ?? []) {
        questionCounts.set(q.assessment_id, (questionCounts.get(q.assessment_id) || 0) + 1);
      }

      // Student's attempts for these assessments
      const { data: studentAttempts } = assessmentIds.length > 0
        ? await admin
            .from("attempts")
            .select("id, assessment_id, score, total, started_at, submitted_at, created_at")
            .eq("student_id", auth.user.id)
            .in("assessment_id", assessmentIds)
            .order("submitted_at", { ascending: false })
        : { data: [] };

      const attemptsByAssessment = new Map<string, typeof studentAttempts>();
      for (const att of studentAttempts ?? []) {
        const list = attemptsByAssessment.get(att.assessment_id) || [];
        list.push(att);
        attemptsByAssessment.set(att.assessment_id, list);
      }

      const assessmentsWithResults = assessmentsList.map((a) => {
        const atts = attemptsByAssessment.get(a.id) || [];
        const submitted = atts.find((att) => att.submitted_at !== null);
        const inProgress = atts.find((att) => att.submitted_at === null && att.started_at !== null);

        let status: "completed" | "in_progress" | "not_attempted" = "not_attempted";
        let scoreInfo: {
          score: number;
          total: number;
          percentage: number;
          passFail: "Pass" | "Fail";
        } | null = null;
        let attemptId: string | null = null;

        if (submitted) {
          status = "completed";
          attemptId = submitted.id;
          const score = submitted.score ?? 0;
          const total = submitted.total && submitted.total > 0 ? submitted.total : 1;
          const percentage = Math.round((score / total) * 100);
          const passFail: "Pass" | "Fail" = percentage >= 50 ? "Pass" : "Fail";
          scoreInfo = { score, total, percentage, passFail };
        } else if (inProgress) {
          status = "in_progress";
          attemptId = inProgress.id;
        }

        const dateStr = submitted?.submitted_at || inProgress?.started_at || a.created_at;

        return {
          id: a.id,
          title: a.title,
          topic: a.topic || null,
          questionCount: questionCounts.get(a.id) || 0,
          date: formatDate(dateStr),
          rawDate: dateStr,
          status,
          score: scoreInfo,
          attemptId,
          hasResult: status === "completed",
        };
      });

      return NextResponse.json({
        class: {
          id: cls.id,
          name: cls.name,
          subject: cls.subject || "General",
          grade: cls.grade || "N/A",
          code: cls.code,
          teacher: teacherMap.get(cls.teacher_id) || "Teacher",
        },
        assessments: assessmentsWithResults,
      });
    }

    // 4. Default: Fetch all enrolled classes with performance overview
    const { data: allPublishedAssessments } = await admin
      .from("assessments")
      .select("id, class_id")
      .in("class_id", enrolledClassIds)
      .eq("status", "published");

    const assessmentIdsByClass = new Map<string, string[]>();
    const allAssessmentIds: string[] = [];
    for (const a of allPublishedAssessments ?? []) {
      const list = assessmentIdsByClass.get(a.class_id) || [];
      list.push(a.id);
      assessmentIdsByClass.set(a.class_id, list);
      allAssessmentIds.push(a.id);
    }

    const { data: attempts } = allAssessmentIds.length > 0
      ? await admin
          .from("attempts")
          .select("id, assessment_id, score, total, submitted_at")
          .eq("student_id", auth.user.id)
          .in("assessment_id", allAssessmentIds)
          .not("submitted_at", "is", null)
      : { data: [] };

    const attemptsByAssessmentId = new Map<string, typeof attempts>();
    for (const att of attempts ?? []) {
      const list = attemptsByAssessmentId.get(att.assessment_id) || [];
      list.push(att);
      attemptsByAssessmentId.set(att.assessment_id, list);
    }

    const classes = enrolledClassIds
      .map((classId) => {
        const c = classMap.get(classId);
        if (!c) return null;

        const classAssIds = assessmentIdsByClass.get(classId) || [];
        const classAttempts = classAssIds.flatMap((aid) => attemptsByAssessmentId.get(aid) || []);

        let avgScore: number | null = null;
        if (classAttempts.length > 0) {
          const totalPct = classAttempts.reduce((sum, at) => {
            const total = at.total && at.total > 0 ? at.total : 1;
            return sum + ((at.score ?? 0) / total) * 100;
          }, 0);
          avgScore = Math.round(totalPct / classAttempts.length);
        }

        return {
          id: c.id,
          name: c.name,
          subject: c.subject || "General",
          grade: c.grade || "N/A",
          code: c.code,
          teacher: teacherMap.get(c.teacher_id) || "Teacher",
          totalAssessments: classAssIds.length,
          completedAssessments: classAttempts.length,
          avgScore,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ classes });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal error" } },
      { status: 500 }
    );
  }
}
