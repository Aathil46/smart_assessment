import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { aggregateClassPerformance } from "@/lib/analytics";
import { generateExcelReport } from "@/lib/excelExport";

export async function GET(_: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
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

  // Verify assessment belongs to a class owned by the teacher
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

  // 1. Fetch class members
  const { data: members } = await admin
    .from("class_members")
    .select("student_id")
    .eq("class_id", assessment.class_id);

  const studentIds = (members ?? []).map((m) => m.student_id);

  // 2. Fetch profiles for enrolled students
  let studentProfiles: any[] = [];
  if (studentIds.length > 0) {
    const { data: profilesData } = await admin
      .from("profiles")
      .select("id, name")
      .in("id", studentIds);
    studentProfiles = profilesData ?? [];
  }

  // 3. Fetch attempts for this assessment
  const { data: attempts } = await admin
    .from("attempts")
    .select("id, student_id, score, total, started_at, submitted_at")
    .eq("assessment_id", assessmentId);

  const attemptIds = (attempts ?? []).filter((a) => a.submitted_at).map((a) => a.id);

  // 4. Fetch concept performance for completed attempts
  let conceptPerfs: any[] = [];
  if (attemptIds.length > 0) {
    const { data: cpData } = await admin
      .from("concept_perf")
      .select("attempt_id, concept, correct_count, total_count, accuracy, level")
      .in("attempt_id", attemptIds);
    conceptPerfs = cpData ?? [];
  }

  const performanceResult = aggregateClassPerformance(
    members ?? [],
    studentProfiles,
    attempts ?? [],
    conceptPerfs
  );

  const excelBuffer = await generateExcelReport({
    assessmentTitle: assessment.title,
    className: (assessment.classes as any).name,
    performanceResult,
    conceptPerfs,
    attempts: attempts ?? [],
  });

  const sanitizedTitle = assessment.title.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${sanitizedTitle}-Results.xlsx`;

  return new NextResponse(Buffer.from(excelBuffer) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
