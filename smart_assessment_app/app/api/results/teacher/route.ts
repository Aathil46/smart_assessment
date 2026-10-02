import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { determinePassFail } from "@/lib/conceptEngine";

export interface ResultAssessment {
  id: string;
  title: string;
  description: string;
  displayClass: string;
  studentsCompleted: number;
  studentsTotal: number;
  avgScore: number;
  passRate: number;
  status: "published" | "draft";
  createdAt: string;
  color: "teal" | "blue" | "amber" | "purple" | "rose" | "emerald" | "orange" | "sky";
}

const COLOR_PALETTE: ResultAssessment["color"][] = [
  "teal",
  "blue",
  "amber",
  "purple",
  "rose",
  "emerald",
  "orange",
  "sky",
];

function getColorForId(id: string): ResultAssessment["color"] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % COLOR_PALETTE.length;
  }
  return COLOR_PALETTE[hash] || "teal";
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

export async function GET() {
  try {
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

    // 1. Fetch teacher classes
    const { data: teacherClasses, error: classesError } = await admin
      .from("classes")
      .select("id, name, subject")
      .eq("teacher_id", auth.user.id);

    if (classesError) {
      console.error("Error fetching teacher classes:", classesError);
    }

    const classesList = teacherClasses ?? [];
    const classIds = classesList.map((c) => c.id);
    const classMap = new Map<string, string>(
      classesList.map((c) => [c.id, c.name ? c.name.replace(/^"|"$/g, "") : "Class"])
    );

    // 2. Fetch class members to know studentsTotal per class
    let classMembers: any[] = [];
    if (classIds.length > 0) {
      const { data: cm, error: cmError } = await admin
        .from("class_members")
        .select("class_id, student_id")
        .in("class_id", classIds);
      if (cmError) console.error("Error fetching class_members:", cmError);
      classMembers = cm ?? [];
    }

    const classStudentsMap = new Map<string, Set<string>>();
    for (const m of classMembers) {
      if (!classStudentsMap.has(m.class_id)) {
        classStudentsMap.set(m.class_id, new Set());
      }
      classStudentsMap.get(m.class_id)!.add(m.student_id);
    }

    // 3. Fetch assessments for this teacher (either created by teacher or belonging to teacher's classes)
    let assessmentsQuery = admin
      .from("assessments")
      .select("id, class_id, title, topic, status, created_at, opens_at, closes_at")
      .order("created_at", { ascending: false });

    if (classIds.length > 0) {
      assessmentsQuery = assessmentsQuery.or(
        `created_by.eq.${auth.user.id},class_id.in.(${classIds.join(",")})`
      );
    } else {
      assessmentsQuery = assessmentsQuery.eq("created_by", auth.user.id);
    }

    const { data: assessments, error: assessmentsError } = await assessmentsQuery;
    if (assessmentsError) {
      console.error("Error fetching assessments:", assessmentsError);
    }

    const assessmentList = assessments ?? [];
    if (assessmentList.length === 0) {
      return NextResponse.json({ assessments: [] });
    }

    const assessmentIds = assessmentList.map((a) => a.id);

    // 4. Fetch attempts for all these assessments
    let attempts: any[] = [];
    if (assessmentIds.length > 0) {
      const { data: att, error: attError } = await admin
        .from("attempts")
        .select("id, assessment_id, student_id, score, total, started_at, submitted_at")
        .in("assessment_id", assessmentIds);
      if (attError) console.error("Error fetching attempts:", attError);
      attempts = att ?? [];
    }

    // Map attempts by assessment_id -> student_id -> latest attempt
    const attemptsByAssessment = new Map<string, Map<string, any>>();
    for (const att of attempts) {
      if (!attemptsByAssessment.has(att.assessment_id)) {
        attemptsByAssessment.set(att.assessment_id, new Map());
      }
      const studentAttempts = attemptsByAssessment.get(att.assessment_id)!;
      const existing = studentAttempts.get(att.student_id);
      if (!existing) {
        studentAttempts.set(att.student_id, att);
      } else {
        const existingTime = existing.submitted_at ?? existing.started_at;
        const attTime = att.submitted_at ?? att.started_at;
        if (attTime && (!existingTime || new Date(attTime) > new Date(existingTime))) {
          studentAttempts.set(att.student_id, att);
        }
      }
    }

    // 5. Build ResultAssessment array
    const resultAssessments: ResultAssessment[] = assessmentList.map((a) => {
      const className = a.class_id ? classMap.get(a.class_id) || "Class" : "Class";
      const studentsTotal = a.class_id ? classStudentsMap.get(a.class_id)?.size || 0 : 0;
      const studentAttempts = attemptsByAssessment.get(a.id);

      let studentsCompleted = 0;
      let totalScorePct = 0;
      let passCount = 0;

      if (studentAttempts) {
        for (const att of studentAttempts.values()) {
          if (att.submitted_at) {
            studentsCompleted++;
            const score = att.score ?? 0;
            const total = att.total && att.total > 0 ? att.total : 1;
            const pct = (score / total) * 100;
            totalScorePct += pct;
            if (determinePassFail(score, att.total ?? 0) === "Pass") {
              passCount++;
            }
          }
        }
      }

      const avgScore = studentsCompleted > 0 ? Math.round(totalScorePct / studentsCompleted) : 0;
      const passRate = studentsCompleted > 0 ? Math.round((passCount / studentsCompleted) * 100) : 0;

      return {
        id: a.id,
        title: a.title,
        description: a.topic || `Assessment for ${className}`,
        displayClass: className,
        studentsCompleted,
        studentsTotal,
        avgScore,
        passRate,
        status: a.status === "published" ? "published" : "draft",
        createdAt: formatDate(a.created_at),
        color: getColorForId(a.id),
      };
    });

    return NextResponse.json({ assessments: resultAssessments });
  } catch (error) {
    console.error("GET /api/results/teacher uncaught error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load teacher results." } },
      { status: 500 }
    );
  }
}
