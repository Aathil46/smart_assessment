import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { aggregateClassPerformance } from "@/lib/analytics";
import { requirePrincipalSession } from "@/lib/auth/principal";

type QueryDebug = {
  query: string;
  error: {
    message: string;
    code: string | null;
    details: string | null;
    hint: string | null;
  } | null;
  rowCount: number;
};

function getQueryDebug(query: string, data: unknown, error: any): QueryDebug {
  const rowCount = Array.isArray(data) ? data.length : data ? 1 : 0;
  const queryDebug: QueryDebug = {
    query,
    error: error
      ? {
          message: error.message ?? "Unknown Supabase error",
          code: error.code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        }
      : null,
    rowCount,
  };

  if (error) {
    console.error(`[principal results] ${query} query failed`, queryDebug);
  } else {
    console.info(`[principal results] ${query} query returned ${rowCount} row(s)`);
  }

  return queryDebug;
}

function getDebugResponse(debug: {
  principalUserId: string;
  assessmentId: string;
  classId: string | null;
  memberCount: number;
  studentProfileCount: number;
  attemptCount: number;
  submittedAttemptCount: number;
  conceptPerformanceCount: number;
  queries: QueryDebug[];
}) {
  return process.env.NODE_ENV === "production" ? {} : { _debug: debug };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const queryDebug: QueryDebug[] = [];
  let principalUserId = "unknown";
  let classId: string | null = null;
  let memberCount = 0;
  let studentProfileCount = 0;
  let attemptCount = 0;
  let submittedAttemptCount = 0;
  let conceptPerformanceCount = 0;

  const debugResponse = () =>
    getDebugResponse({
      principalUserId,
      assessmentId: assessmentIdForDebug,
      classId,
      memberCount,
      studentProfileCount,
      attemptCount,
      submittedAttemptCount,
      conceptPerformanceCount,
      queries: queryDebug,
    });

  let assessmentIdForDebug = "unknown";

  try {
    const { id } = await params;
    assessmentIdForDebug = id;
    const { user } = await requirePrincipalSession();
    principalUserId = user.id;

    // The authenticated client applies the RLS policies automatically.
    // Principals can only see assessments, attempts, members, etc. if the teacher belongs to their school.
    const supabase = await createServerSupabaseClient();

    // Verify assessment (RLS will return null if unauthorized/cross-school)
    const assessmentQuery = await supabase
      .from("assessments")
      .select("*, classes!inner(name, teacher_id, profiles!classes_teacher_id_fkey(name))")
      .eq("id", id)
      .single();
    queryDebug.push(getQueryDebug("assessment", assessmentQuery.data, assessmentQuery.error));

    if (assessmentQuery.error) {
      return NextResponse.json(
        { error: { message: "Assessment query failed.", details: assessmentQuery.error.message }, ...debugResponse() },
        { status: 500 },
      );
    }

    const assessment = assessmentQuery.data;

    if (!assessment) {
      return NextResponse.json(
        { error: { message: "Assessment not found or unauthorized." }, ...debugResponse() },
        { status: 404 },
      );
    }
    classId = assessment.class_id;

    const teacherName = Array.isArray(assessment.classes.profiles) 
      ? assessment.classes.profiles[0]?.name 
      : (assessment.classes.profiles as any)?.name;

    // 1. Fetch class members
    const membersQuery = await supabase
      .from("class_members")
      .select("student_id")
      .eq("class_id", assessment.class_id);
    queryDebug.push(getQueryDebug("class_members", membersQuery.data, membersQuery.error));

    if (membersQuery.error) {
      return NextResponse.json(
        { error: { message: "Class members query failed.", details: membersQuery.error.message }, ...debugResponse() },
        { status: 500 },
      );
    }

    const members = membersQuery.data ?? [];
    memberCount = members.length;

    const studentIds = members.map((m) => m.student_id);

    // 2. Fetch profiles for enrolled students
    let studentProfiles: any[] = [];
    if (studentIds.length > 0) {
      const profilesQuery = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", studentIds);
      queryDebug.push(getQueryDebug("profiles", profilesQuery.data, profilesQuery.error));

      if (profilesQuery.error) {
        return NextResponse.json(
          { error: { message: "Student profiles query failed.", details: profilesQuery.error.message }, ...debugResponse() },
          { status: 500 },
        );
      }

      studentProfiles = profilesQuery.data ?? [];
    }
    studentProfileCount = studentProfiles.length;

    // 3. Fetch attempts for this assessment
    const attemptsQuery = await supabase
      .from("attempts")
      .select("id, student_id, score, total, started_at, submitted_at")
      .eq("assessment_id", id);
    queryDebug.push(getQueryDebug("attempts", attemptsQuery.data, attemptsQuery.error));

    if (attemptsQuery.error) {
      return NextResponse.json(
        { error: { message: "Attempts query failed.", details: attemptsQuery.error.message }, ...debugResponse() },
        { status: 500 },
      );
    }

    const attempts = attemptsQuery.data ?? [];
    attemptCount = attempts.length;
    submittedAttemptCount = attempts.filter((attempt) => attempt.submitted_at !== null).length;

    const attemptIds = attempts.filter((a) => a.submitted_at).map((a) => a.id);

    // 4. Fetch concept performance for completed attempts
    let conceptPerfs: any[] = [];
    if (attemptIds.length > 0) {
      const conceptPerfQuery = await supabase
        .from("concept_perf")
        .select("attempt_id, concept, correct_count, total_count, accuracy")
        .in("attempt_id", attemptIds);
      queryDebug.push(getQueryDebug("concept_perf", conceptPerfQuery.data, conceptPerfQuery.error));

      if (conceptPerfQuery.error) {
        return NextResponse.json(
          { error: { message: "Concept performance query failed.", details: conceptPerfQuery.error.message }, ...debugResponse() },
          { status: 500 },
        );
      }

      conceptPerfs = conceptPerfQuery.data ?? [];
    }
    conceptPerformanceCount = conceptPerfs.length;

    const result = aggregateClassPerformance(
      members,
      studentProfiles,
      attempts,
      conceptPerfs
    );

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        title: assessment.title,
        topic: assessment.topic,
        class_name: assessment.classes.name,
        teacher_name: teacherName || "Unknown",
      },
      ...result,
      ...debugResponse(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { message: error.message || "Internal server error" }, ...debugResponse() },
      { status: 500 },
    );
  }
}
