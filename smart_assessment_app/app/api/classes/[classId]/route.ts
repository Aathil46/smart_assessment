import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 30) return `${diffDay} days ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
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

    // 1. Fetch class
    const { data: cls, error: clsError } = await admin
      .from("classes")
      .select("*")
      .eq("id", classId)
      .eq("teacher_id", auth.user.id)
      .single();

    if (clsError || !cls) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Class not found." } },
        { status: 404 }
      );
    }

    // 2. Fetch enrolled students
    const { data: members } = await admin
      .from("class_members")
      .select("student_id, joined_at")
      .eq("class_id", classId);

    const studentIds = (members ?? []).map((m) => m.student_id);

    let studentProfiles: any[] = [];
    if (studentIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, name, email")
        .in("id", studentIds);
      studentProfiles = profiles ?? [];
    }
    const profileMap = new Map(studentProfiles.map((p) => [p.id, p]));
    const memberMap = new Map((members ?? []).map((m) => [m.student_id, m]));

    // 3. Fetch class assessments
    const { data: classAssessments } = await admin
      .from("assessments")
      .select("id, title, topic, status, time_limit, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });

    const assessmentsList = classAssessments ?? [];
    const assessmentIds = assessmentsList.map((a) => a.id);

    // 4. Fetch question counts
    const { data: questionRows } = assessmentIds.length > 0
      ? await admin.from("questions").select("id, assessment_id").in("assessment_id", assessmentIds)
      : { data: [] };

    const questionCountMap = new Map<string, number>();
    for (const q of questionRows ?? []) {
      questionCountMap.set(q.assessment_id, (questionCountMap.get(q.assessment_id) || 0) + 1);
    }

    // 5. Fetch attempts for all assessments in this class
    const { data: attemptRows } = assessmentIds.length > 0
      ? await admin
          .from("attempts")
          .select("id, assessment_id, student_id, score, total, started_at, submitted_at, created_at")
          .in("assessment_id", assessmentIds)
      : { data: [] };

    const allAttempts = attemptRows ?? [];
    const submittedAttempts = allAttempts.filter((a) => a.submitted_at && a.total && a.total > 0);

    // Group attempts by assessment
    const attemptsByAssessment = new Map<string, typeof allAttempts>();
    for (const at of allAttempts) {
      const list = attemptsByAssessment.get(at.assessment_id) || [];
      list.push(at);
      attemptsByAssessment.set(at.assessment_id, list);
    }

    // Group attempts by student
    const attemptsByStudent = new Map<string, typeof allAttempts>();
    for (const at of allAttempts) {
      const list = attemptsByStudent.get(at.student_id) || [];
      list.push(at);
      attemptsByStudent.set(at.student_id, list);
    }

    // 6. Build students list
    const studentCount = studentIds.length;
    const students = studentIds.map((studentId, idx) => {
      const prof = profileMap.get(studentId);
      const studentName = prof?.name?.trim() || prof?.email?.split("@")[0] || `Student ${idx + 1}`;
      const initials = studentName
        .split(" ")
        .map((n: string) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "ST";

      const studentAts = attemptsByStudent.get(studentId) || [];
      const studentSubmitted = studentAts.filter((a) => a.submitted_at && a.total && a.total > 0);

      let avgScore = 0;
      if (studentSubmitted.length > 0) {
        const totalPct = studentSubmitted.reduce((sum, a) => sum + ((a.score ?? 0) / a.total) * 100, 0);
        avgScore = Math.round(totalPct / studentSubmitted.length);
      }

      // Determine latest active date
      const latestAttemptDate = studentAts
        .map((a) => a.submitted_at || a.started_at || a.created_at)
        .filter(Boolean)
        .sort()
        .reverse()[0];
      const memberInfo = memberMap.get(studentId);
      const lastActiveDate = latestAttemptDate || memberInfo?.joined_at;

      return {
        id: studentId,
        name: studentName,
        avatar: initials,
        avgScore,
        assessmentsTaken: studentSubmitted.length,
        lastActive: formatRelativeTime(lastActiveDate),
      };
    });

    // 7. Build assessments list
    const assessments = assessmentsList.map((a) => {
      const ats = attemptsByAssessment.get(a.id) || [];
      const submitted = ats.filter((at) => at.submitted_at);
      const qCount = questionCountMap.get(a.id) || 0;
      const duration = a.time_limit || Math.max(qCount * 2, 15);

      const submittedWithScore = submitted.filter((at) => at.total && at.total > 0);
      const avgScore = submittedWithScore.length > 0
        ? Math.round(submittedWithScore.reduce((sum, at) => sum + ((at.score ?? 0) / at.total) * 100, 0) / submittedWithScore.length)
        : 0;

      return {
        id: a.id,
        title: a.title,
        questionCount: qCount,
        duration,
        avgScore,
        participation: {
          completed: submitted.length,
          total: studentCount,
        },
        status: (a.status === "published" ? "published" : "draft") as "published" | "draft",
        createdAt: a.created_at,
      };
    });

    // 8. Overall stats
    let avgPerformance: number | null = null;
    let passRate = 0;
    if (submittedAttempts.length > 0) {
      const totalPct = submittedAttempts.reduce((sum, a) => sum + ((a.score ?? 0) / a.total) * 100, 0);
      avgPerformance = Math.round(totalPct / submittedAttempts.length);

      const passingAttempts = submittedAttempts.filter((a) => ((a.score ?? 0) / a.total) >= 0.5);
      passRate = Math.round((passingAttempts.length / submittedAttempts.length) * 100);
    }

    // 9. Analytics data
    const performanceData = assessments
      .filter((a) => a.status === "published")
      .map((a) => ({
        label: a.title.length > 18 ? a.title.slice(0, 16) + "..." : a.title,
        value: a.avgScore,
        color: "bg-brand-500",
      }));

    // Participation Rate calculation
    const publishedAssessments = assessments.filter((a) => a.status === "published");
    const totalExpected = studentCount * publishedAssessments.length;
    let completedPct = 0;
    let inProgressPct = 0;
    let notStartedPct = 100;

    if (totalExpected > 0) {
      const publishedIds = new Set(publishedAssessments.map((a) => a.id));
      const relevantAttempts = allAttempts.filter((a) => publishedIds.has(a.assessment_id));
      const completedCount = relevantAttempts.filter((a) => a.submitted_at).length;
      const inProgressCount = relevantAttempts.filter((a) => a.started_at && !a.submitted_at).length;

      completedPct = Math.min(100, Math.round((completedCount / totalExpected) * 100));
      inProgressPct = Math.min(100 - completedPct, Math.round((inProgressCount / totalExpected) * 100));
      notStartedPct = Math.max(0, 100 - completedPct - inProgressPct);
    }

    return NextResponse.json({
      class: {
        id: cls.id,
        name: cls.name,
        subject: cls.subject || "General",
        grade: cls.grade || "N/A",
        joinCode: cls.code,
        studentCount,
        assessmentCount: assessments.length,
        avgPerformance,
        passRate,
        color: "brand",
        createdAt: cls.created_at,
      },
      students,
      assessments,
      performanceData,
      participation: [
        { label: "Completed", value: completedPct, color: "#0d9488" },
        { label: "In Progress", value: inProgressPct, color: "#f59e0b" },
        { label: "Not Started", value: notStartedPct, color: "#e2e8f0" },
      ],
      completedRate: `${completedPct}%`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal error" } },
      { status: 500 }
    );
  }
}
