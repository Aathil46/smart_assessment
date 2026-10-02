import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classifyConceptLevel, determinePassFail } from "@/lib/conceptEngine";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "ST";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const url = new URL(request.url);
    const targetAssessmentId = url.searchParams.get("assessmentId");

    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
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
      .maybeSingle();

    const isTeacher =
      profile?.role?.toLowerCase() === "teacher" ||
      auth.user.user_metadata?.role?.toLowerCase() === "teacher";

    if (!isTeacher) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Teacher access required." } },
        { status: 403 }
      );
    }

    // 1. Fetch student profile
    const { data: studentProfile, error: studentError } = await admin
      .from("profiles")
      .select("id, name, email")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !studentProfile) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Student not found." } },
        { status: 404 }
      );
    }

    const studentName = studentProfile.name || "Student";
    const studentAvatar = getInitials(studentName);

    // 2. Fetch classes taught by this teacher
    const { data: teacherClasses } = await admin
      .from("classes")
      .select("id, name")
      .eq("teacher_id", auth.user.id);

    const classesList = teacherClasses ?? [];
    const classIds = classesList.map((c) => c.id);
    const classMap = new Map<string, string>(
      classesList.map((c) => [c.id, c.name ? c.name.replace(/^"|"$/g, "") : "Class"])
    );

    // 3. Find primary class for student
    let primaryClassName = "Class";
    if (classIds.length > 0) {
      const { data: memberships } = await admin
        .from("class_members")
        .select("class_id")
        .eq("student_id", studentId)
        .in("class_id", classIds);

      const enrolledClassIds = (memberships ?? []).map((m) => m.class_id);
      if (enrolledClassIds.length > 0) {
        primaryClassName = classMap.get(enrolledClassIds[0]) || "Class";
      }
    }

    // 4. Fetch assessments for this teacher (either created by teacher or in teacher's classes)
    let assessmentsQuery = admin
      .from("assessments")
      .select("id, title, topic, class_id, created_at")
      .order("created_at", { ascending: false });

    if (classIds.length > 0) {
      assessmentsQuery = assessmentsQuery.or(
        `created_by.eq.${auth.user.id},class_id.in.(${classIds.join(",")})`
      );
    } else {
      assessmentsQuery = assessmentsQuery.eq("created_by", auth.user.id);
    }

    const { data: assessments } = await assessmentsQuery;
    const assessmentList = assessments ?? [];
    const assessmentMap = new Map<string, any>(assessmentList.map((a) => [a.id, a]));
    const assessmentIds = assessmentList.map((a) => a.id);

    const emptyResult = {
      studentName,
      studentAvatar,
      className: primaryClassName,
      avgScore: 0,
      bestScore: 0,
      latest: null,
      conceptPerf: [],
      strong: [],
      medium: [],
      weak: [],
      learningGaps: [],
      studentResultsList: [],
    };

    if (assessmentIds.length === 0) {
      return NextResponse.json(emptyResult);
    }

    // 5. Fetch attempts by this student on this teacher's assessments
    const { data: attempts } = await admin
      .from("attempts")
      .select("id, assessment_id, score, total, started_at, submitted_at, created_at")
      .eq("student_id", studentId)
      .in("assessment_id", assessmentIds)
      .order("submitted_at", { ascending: false });

    const attemptList = attempts ?? [];
    const submittedAttempts = attemptList.filter((a) => a.submitted_at);

    if (submittedAttempts.length === 0) {
      return NextResponse.json(emptyResult);
    }

    // Pick latest attempt (matching targetAssessmentId if provided, else the most recent)
    let latestAttempt = submittedAttempts[0];
    if (targetAssessmentId) {
      const match = submittedAttempts.find((a) => a.assessment_id === targetAssessmentId);
      if (match) latestAttempt = match;
    }

    const latestAssessment = assessmentMap.get(latestAttempt.assessment_id);

    // 6. Fetch concept performance and learning gaps for latest attempt
    const [{ data: rawPerformance }, { data: rawGaps }] = await Promise.all([
      admin
        .from("concept_perf")
        .select("concept, correct_count, total_count, accuracy, level")
        .eq("attempt_id", latestAttempt.id),
      admin
        .from("learning_gaps")
        .select("concept, gap_level, notes, recommendations")
        .eq("attempt_id", latestAttempt.id),
    ]);

    const conceptPerf = (rawPerformance ?? []).map((cp) => {
      const acc = Number(cp.accuracy);
      const score = Math.round(acc * 100);
      const level = cp.level ?? classifyConceptLevel(acc);
      const mastery: "strong" | "medium" | "weak" =
        level === "Strong" ? "strong" : level === "Medium" ? "medium" : "weak";
      return {
        concept: cp.concept,
        score,
        mastery,
      };
    });

    const strong = conceptPerf.filter((c) => c.mastery === "strong");
    const medium = conceptPerf.filter((c) => c.mastery === "medium");
    const weak = conceptPerf.filter((c) => c.mastery === "weak");

    const learningGaps = (rawGaps ?? []).map(
      (g) => g.concept || g.notes || "Learning gap identified"
    );

    const latestScore =
      latestAttempt.total && latestAttempt.total > 0
        ? Math.round(((latestAttempt.score ?? 0) / latestAttempt.total) * 100)
        : 0;

    const latestPassed =
      determinePassFail(latestAttempt.score ?? 0, latestAttempt.total ?? 0) === "Pass";

    const latestTimeSpent =
      latestAttempt.started_at && latestAttempt.submitted_at
        ? Math.max(
            1,
            Math.round(
              (new Date(latestAttempt.submitted_at).getTime() -
                new Date(latestAttempt.started_at).getTime()) /
                60000
            )
          )
        : 15;

    const studentResultsList = submittedAttempts.map((att) => {
      const a = assessmentMap.get(att.assessment_id);
      const pct =
        att.total && att.total > 0 ? Math.round(((att.score ?? 0) / att.total) * 100) : 0;
      const passed = determinePassFail(att.score ?? 0, att.total ?? 0) === "Pass";
      const timeSpent =
        att.started_at && att.submitted_at
          ? Math.max(
              1,
              Math.round(
                (new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime()) / 60000
              )
            )
          : 15;

      return {
        id: att.id,
        assessmentId: att.assessment_id,
        assessmentTitle: a?.title || "Assessment",
        score: pct,
        passed,
        timeSpent,
        submittedAt: formatDate(att.submitted_at),
      };
    });

    const allScores = studentResultsList.map((r) => r.score);
    const avgScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((x, y) => x + y, 0) / allScores.length)
        : 0;
    const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;

    return NextResponse.json({
      studentName,
      studentAvatar,
      className: latestAssessment?.class_id
        ? classMap.get(latestAssessment.class_id) || primaryClassName
        : primaryClassName,
      avgScore,
      bestScore,
      latest: {
        assessmentId: latestAttempt.assessment_id,
        assessmentTitle: latestAssessment?.title || "Assessment",
        score: latestScore,
        passed: latestPassed,
        timeSpent: latestTimeSpent,
      },
      conceptPerf,
      strong,
      medium,
      weak,
      learningGaps,
      studentResultsList,
    });
  } catch (error) {
    console.error("GET /api/results/teacher/student/[studentId] uncaught error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load student result." } },
      { status: 500 }
    );
  }
}
